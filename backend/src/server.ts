import { env } from './config/env';
import { createApp } from './app';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`Backend listening on port ${env.PORT}`);
});
