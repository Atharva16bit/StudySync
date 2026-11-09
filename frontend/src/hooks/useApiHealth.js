import { useEffect, useState } from "react";

export function useApiHealth() {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    const controller = new AbortController();

    async function checkHealth() {
      try {
        const response = await fetch("/api/health", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Health check failed: ${response.status}`);
        }

        const data = await response.json();

        if (data.status !== "ok" || data.service !== "studysync-api") {
          throw new Error("Unexpected health response");
        }

        setStatus("online");
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("API health check:", error);
          setStatus("offline");
        }
      }
    }

    checkHealth();

    return () => controller.abort();
  }, []);

  return status;
}
