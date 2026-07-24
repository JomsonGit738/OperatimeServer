const https = require("node:https");

const TMDB_API_BASE = process.env.TMDB_API_BASE || "https://api.themoviedb.org/3";
const TMDB_READ_TOKEN = process.env.TMDB_READ_TOKEN;
const TMDB_CACHE_TTL_MS = Number(
  process.env.TMDB_CACHE_TTL_MS || 5 * 60 * 1000
);
const responseCache = new Map();
const inFlightRequests = new Map();

const requestTmdbOnce = (path, query = {}) =>
  new Promise((resolve, reject) => {
    if (!TMDB_READ_TOKEN) {
      const error = new Error("TMDB_READ_TOKEN is not configured");
      error.statusCode = 503;
      reject(error);
      return;
    }

    const url = new URL(path, `${TMDB_API_BASE}/`);
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });

    const request = https.get(
      url,
      {
        // A fresh socket avoids reusing a connection that TMDB has already closed.
        agent: false,
        headers: {
          accept: "application/json",
          "User-Agent": "OperatimeServer/1.0",
          // TMDB credentials stay on the server and never enter the Angular bundle.
          Authorization: `Bearer ${TMDB_READ_TOKEN}`,
        },
      },
      (tmdbResponse) => {
        let body = "";
        tmdbResponse.setEncoding("utf8");
        tmdbResponse.on("data", (chunk) => {
          body += chunk;
        });
        tmdbResponse.on("end", () => {
          let data;
          try {
            data = body ? JSON.parse(body) : {};
          } catch {
            reject(new Error("TMDB returned an invalid JSON response"));
            return;
          }

          if (
            !tmdbResponse.statusCode ||
            tmdbResponse.statusCode < 200 ||
            tmdbResponse.statusCode >= 300
          ) {
            const error = new Error(data.status_message || "TMDB request failed");
            error.statusCode = tmdbResponse.statusCode || 502;
            reject(error);
            return;
          }

          resolve(data);
        });
      }
    );

    request.setTimeout(10_000, () => {
      request.destroy(new Error("TMDB request timed out"));
    });
    request.on("error", reject);
  });

const fetchTmdbWithRetry = async (path, query = {}) => {
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await requestTmdbOnce(path, query);
    } catch (error) {
      const isConfigurationError =
        error.message === "TMDB_READ_TOKEN is not configured";
      const isClientError =
        Number.isInteger(error.statusCode) && error.statusCode < 500;
      if (attempt === maxAttempts || isConfigurationError || isClientError) {
        throw error;
      }

      // TMDB occasionally resets a socket; retry briefly instead of exposing a guest 502.
      await new Promise((resolve) => setTimeout(resolve, attempt * 150));
    }
  }
};

const requestTmdb = async (path, query = {}) => {
  const cacheKey = JSON.stringify([path, query]);
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.storedAt < TMDB_CACHE_TTL_MS) {
    return cached.data;
  }

  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const request = fetchTmdbWithRetry(path, query)
    .then((data) => {
      responseCache.set(cacheKey, { data, storedAt: Date.now() });
      return data;
    })
    .catch((error) => {
      // Catalog data can safely fall back to a stale cached response during a brief outage.
      if (cached) {
        return cached.data;
      }
      throw error;
    })
    .finally(() => inFlightRequests.delete(cacheKey));

  inFlightRequests.set(cacheKey, request);
  return request;
};

const sendTmdbResponse = async (response, requestFactory) => {
  try {
    response.status(200).json(await requestFactory());
  } catch (error) {
    const status =
      Number.isInteger(error.statusCode) && error.statusCode < 500
        ? error.statusCode
        : error.statusCode === 503
          ? 503
          : 502;
    response.status(status).json({ message: error.message });
  }
};

exports.getPopular = (_request, response) =>
  sendTmdbResponse(response, () => requestTmdb("movie/popular"));

exports.getGenres = (_request, response) =>
  sendTmdbResponse(response, () => requestTmdb("genre/movie/list"));

exports.getNowPlaying = (_request, response) =>
  sendTmdbResponse(response, () => requestTmdb("movie/now_playing"));

exports.search = (request, response) =>
  sendTmdbResponse(response, () =>
    requestTmdb("search/movie", {
      query: request.query.query,
      include_adult: "false",
      language: "en-US",
      page: request.query.page || "1",
    })
  );

exports.getMovie = (request, response) =>
  sendTmdbResponse(response, () =>
    requestTmdb(`movie/${encodeURIComponent(request.params.id)}`)
  );

exports.getFullMovie = (request, response) =>
  sendTmdbResponse(response, async () => {
    const movie = await requestTmdb(
      `movie/${encodeURIComponent(request.params.id)}`,
      { append_to_response: "videos,credits" }
    );

    // Preserve the frontend's existing model while using TMDB's current "credits" name.
    if (movie.credits && !movie.casts) {
      movie.casts = movie.credits;
      delete movie.credits;
    }
    return movie;
  });
