import { useCallback, useEffect, useState } from "react";

export async function api(path, { method = "GET", body, signal } = {}) {
  const multipart = body instanceof FormData;
  const hasBody = body !== undefined;

  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(hasBody && !multipart ? { "Content-Type": "application/json" } : {}),
    },
    body: hasBody ? (multipart ? body : JSON.stringify(body)) : undefined,
    signal,
  });

  if (response.status === 204) return null;

  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");
  const data = isJson ? await response.json() : null;

  if (!response.ok || !isJson) {
    const error = new Error(
      data?.error?.message ??
        `The StudySync API could not complete this request (${response.status}).`,
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

export function useLoad(path) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({
    data: null,
    error: "",
    loading: true,
  });

  const reload = useCallback(() => {
    setResult({ data: null, error: "", loading: true });
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    api(path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult({ data, error: "", loading: false });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({ data: null, error: error.message, loading: false });
        }
      });

    return () => controller.abort();
  }, [path, revision]);

  return { ...result, reload };
}

export function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
