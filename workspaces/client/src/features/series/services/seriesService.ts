import { createFetch, createSchema } from '@better-fetch/fetch';
import { StandardSchemaV1 } from '@standard-schema/spec';
import { getSeriesResponse, getSeriesRequestQuery, getSeriesByIdResponse} from '@wsh-2025/schema/src/api/schema';
import { create, windowedFiniteBatchScheduler } from '@yornaath/batshit';

import { schedulePlugin } from '@wsh-2025/client/src/features/requests/schedulePlugin';

const $fetch = createFetch({
  baseURL: process.env['API_BASE_URL'] ?? '/api',
  plugins: [schedulePlugin],
  schema: createSchema({
    '/series': {
      output: getSeriesResponse,
      query: getSeriesRequestQuery,
    },
    '/series/:seriesId': {
      output: getSeriesByIdResponse,
    },
  }),
  throw: true,
});

const batcher = create({
  async fetcher(queries: { seriesId: string }[]) {
    const data = await $fetch('/series', {
      query: {
        seriesIds: queries.map((q) => q.seriesId).join(','),
      },
    });
    return data;
  },
  resolver(items, query: { seriesId: string }) {
    const item = items.find((item) => item.id === query.seriesId);
    if (item == null) {
      throw new Error('Series is not found.');
    }
    return item;
  },
  scheduler: windowedFiniteBatchScheduler({
    maxBatchSize: 100,
    windowMs: 1000,
  }),
});

interface SeriesService {
  fetchSeries: () => Promise<StandardSchemaV1.InferOutput<typeof getSeriesResponse>>;
  fetchSeriesById: (params: {
    seriesId: string;
  }) => Promise<StandardSchemaV1.InferOutput<typeof getSeriesByIdResponse>>;
}

export const seriesService: SeriesService = {
  async fetchSeries() {
    const data = await $fetch('/series', { query: {} });
    return data;
  },
  async fetchSeriesById({ seriesId }) {
    const data = await batcher.fetch({ seriesId });
    return data;
  },
};
