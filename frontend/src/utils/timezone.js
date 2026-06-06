const timezoneAliases = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Bangalore": "Asia/Kolkata",
  "Asia/Bengaluru": "Asia/Kolkata"
};

export function normalizeTimeZone(timezone) {
  const candidate = timezoneAliases[timezone] || timezone;

  if (!candidate) {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  }

  try {
    Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  }
}
