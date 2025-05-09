import { createFetch, createSchema } from '@better-fetch/fetch';
import { StandardSchemaV1 } from '@standard-schema/spec';
import { getProgramsResponse, getProgramsRequestQuery, getProgramByIdResponse, getProgramByIdRequestParams} from '@wsh-2025/schema/src/api/schema';
import { create, windowedFiniteBatchScheduler } from '@yornaath/batshit';

import { schedulePlugin } from '@wsh-2025/client/src/features/requests/schedulePlugin';

const $fetch = createFetch({
  baseURL: process.env['API_BASE_URL'] ?? '/api',
  plugins: [schedulePlugin],
  schema: createSchema({
    '/programs': {
      output: getProgramsResponse,
      query: getProgramsRequestQuery,
    },
    '/programs/:episodeId': {
      output: getProgramByIdResponse,
      params: getProgramByIdRequestParams,
    },
  }),
  throw: true,
});

const batcher = create({
  async fetcher(queries: { programId: string }[]) {
    const data = await $fetch('/programs', {
      query: {
        programIds: queries.map((q) => q.programId).join(','),
      },
    });
    return data;
  },
  resolver(items, query: { programId: string }) {
    const item = items.find((item) => item.id === query.programId);
    if (item == null) {
      throw new Error('Program is not found.');
    }
    return item;
  },
  scheduler: windowedFiniteBatchScheduler({
    maxBatchSize: 100,
    windowMs: 1000,
  }),
});

interface ProgramService {
  fetchProgramById: (query: {
    programId: string;
  }) => Promise<StandardSchemaV1.InferOutput<typeof getProgramByIdResponse>>;
  fetchPrograms: () => Promise<StandardSchemaV1.InferOutput<typeof getProgramsResponse>>;
}

export const programService: ProgramService = {
  async fetchProgramById({ programId }) {
    const channel = await batcher.fetch({ programId });
    return channel;
  },
  async fetchPrograms() {
    const data = await $fetch('/programs', { query: {} });
    return data;
  },
};
