export async function api(path, body, method = "POST") {
  let response;
  try {
    response = await fetch("/api" + path, {
      method: body === undefined ? "GET" : method,
      headers:
        body instanceof FormData ? {} : { "Content-Type": "application/json" },
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    });
  } catch {
    throw Error(
      "Cannot reach your TaDa server. Check its address, connection and HTTPS certificate.",
    );
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json"))
    throw Error(
      "This address returned a web page instead of the TaDa service. Check that the app is connected to your TaDa server.",
    );
  let data;
  try {
    data = await response.json();
  } catch {
    throw Error(
      "The TaDa server returned an invalid response. Please try again or check the server.",
    );
  }
  if (!response.ok)
    throw Error(
      typeof data?.error === "string"
        ? data.error
        : "The TaDa server could not complete this request.",
    );
  return data;
}
