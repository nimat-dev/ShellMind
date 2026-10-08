export interface PairingConfig {
  deviceId: string;
  token: string;
  host: string;
  port: number;
}

export function parsePairingPayload(
  rawInput: string
): { success: true; data: PairingConfig } | { success: false; error: string } {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { success: false, error: "Pairing payload is empty." };
  }

  let obj: unknown;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    return { success: false, error: "Invalid JSON format in pairing payload." };
  }

  if (typeof obj !== "object" || obj === null) {
    return { success: false, error: "Pairing payload must be an object." };
  }

  const record = obj as Record<string, unknown>;

  if (typeof record.deviceId !== "string" || !record.deviceId.startsWith("dev_")) {
    return {
      success: false,
      error: "Invalid deviceId. Expected 'dev_' prefix.",
    };
  }

  if (typeof record.token !== "string" || !record.token.startsWith("tok_")) {
    return {
      success: false,
      error: "Invalid token. Expected 'tok_' prefix.",
    };
  }

  if (typeof record.host !== "string" || record.host.trim().length === 0) {
    return {
      success: false,
      error: "Invalid host address in pairing payload.",
    };
  }

  const portNum = Number(record.port);
  if (isNaN(portNum) || portNum <= 0 || portNum > 65535) {
    return {
      success: false,
      error: "Invalid port number. Must be between 1 and 65535.",
    };
  }

  return {
    success: true,
    data: {
      deviceId: record.deviceId,
      token: record.token,
      host: record.host.trim(),
      port: portNum,
    },
  };
}
