-- One organization per user (USERS_PER_ORGANIZATION_PLAN.md): every Executive / Normal User
-- membership is in the user's own organization ("User"."organizationId"); Project Admin
-- memberships in client organizations don't count. "Anlet (Internal)" goes away — its admins and
-- members belong to Detecon. Data only, no schema change. One transaction, so the guard at the
-- end leaves everything untouched when it fails.

BEGIN;

-- 1. Detecon exists whenever Anlet (Internal) still has users or members (fresh/dev databases).
INSERT INTO "Organization" ("id", "name", "createdAt", "updatedAt")
SELECT 'o_' || md5('Detecon'), 'Detecon', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Organization" WHERE "name" = 'Detecon')
  AND EXISTS (
    SELECT 1 FROM "Organization" o
    WHERE o."name" = 'Anlet (Internal)'
      AND (EXISTS (SELECT 1 FROM "User" u WHERE u."organizationId" = o."id")
        OR EXISTS (SELECT 1 FROM "Membership" m WHERE m."organizationId" = o."id"))
  );

-- 2. Anlet (Internal) memberships of people who are also members of another organization are
--    removed together with their responses (decided: they were test answers). Answers, comments,
--    KEIs and score snapshots cascade from the response.
CREATE TEMP TABLE "_doomed_membership" AS
SELECT m."id"
FROM "Membership" m
JOIN "Organization" o ON o."id" = m."organizationId" AND o."name" = 'Anlet (Internal)'
WHERE m."role" <> 'PROJECT_ADMIN'
  AND EXISTS (
    SELECT 1 FROM "Membership" other
    WHERE other."userId" = m."userId" AND other."role" <> 'PROJECT_ADMIN' AND other."organizationId" <> m."organizationId"
  );
DELETE FROM "QuestionnaireResponse" WHERE "membershipId" IN (SELECT "id" FROM "_doomed_membership");
DELETE FROM "Membership" WHERE "id" IN (SELECT "id" FROM "_doomed_membership");
DROP TABLE "_doomed_membership";

-- 3. Remaining Anlet (Internal) memberships (people only there) move to Detecon, with their answers.
UPDATE "Membership" m
SET "organizationId" = (SELECT "id" FROM "Organization" WHERE "name" = 'Detecon'), "opCoId" = NULL
FROM "Organization" o
WHERE o."id" = m."organizationId" AND o."name" = 'Anlet (Internal)';

-- 4. Everyone's organization is the one their memberships are in — except Application Admins,
--    who are never moved into a client organization this way (the guard stops instead); people
--    whose organization was Anlet (Internal) (admins) belong to Detecon.
UPDATE "User" u
SET "organizationId" = sub."organizationId"
FROM (
  SELECT "userId", MIN("organizationId") AS "organizationId"
  FROM "Membership"
  WHERE "role" <> 'PROJECT_ADMIN'
  GROUP BY "userId"
  HAVING COUNT(DISTINCT "organizationId") = 1
) sub
WHERE sub."userId" = u."id" AND u."organizationId" <> sub."organizationId" AND u."role" <> 'ADMIN';

UPDATE "User" u
SET "organizationId" = (SELECT "id" FROM "Organization" WHERE "name" = 'Detecon')
FROM "Organization" o
WHERE o."id" = u."organizationId" AND o."name" = 'Anlet (Internal)';

-- 5. Anlet (Internal) itself (never part of a project) and what only describes it.
DELETE FROM "QuestionnaireOrgSetting" WHERE "organizationId" IN (SELECT "id" FROM "Organization" WHERE "name" = 'Anlet (Internal)');
DELETE FROM "ReferenceListEntry" WHERE "organizationId" IN (SELECT "id" FROM "Organization" WHERE "name" = 'Anlet (Internal)');
DELETE FROM "OpCo" WHERE "organizationId" IN (SELECT "id" FROM "Organization" WHERE "name" = 'Anlet (Internal)');
DELETE FROM "Organization" WHERE "name" = 'Anlet (Internal)';

-- 6. Guard: stop here (rolling everything back) if anyone is still a member of an organization other than their own.
DO $$
DECLARE offenders TEXT;
BEGIN
  SELECT string_agg(DISTINCT u."email", ', ') INTO offenders
  FROM "Membership" m JOIN "User" u ON u."id" = m."userId"
  WHERE m."role" <> 'PROJECT_ADMIN' AND m."organizationId" <> u."organizationId";
  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION 'Users in more than one organization: % — resolve before migrating', offenders;
  END IF;
END $$;

COMMIT;
