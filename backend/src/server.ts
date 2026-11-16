import { assertProductionSecrets, env } from './config/env';
import { createApp } from './app';

assertProductionSecrets();

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`Backend listening on port ${env.PORT}`);
});
