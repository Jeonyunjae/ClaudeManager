import type { Config } from 'drizzle-kit';

export default {
  schema: './src/lib/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.CLAUDEMANAGER_HOME
      ? `${process.env.CLAUDEMANAGER_HOME}/data/claudemanager.db`
      : './data/claudemanager.db',
  },
} satisfies Config;
