export async function getApiErrorMessage(res: Response) {
  const txt = await res.text().catch(() => "");
  try {
    const j = JSON.parse(txt);
    return j?.ok === false ? String(j?.error?.message || "Request failed") : txt || `Failed (${res.status})`;
  } catch {
    return txt || `Failed (${res.status})`;
  }
}






