export const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

export const updateBusLocation = async (token, busId, location) => {
  const response = await fetch(`${API_BASE}/bus/update-location`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ busId, location }),
  });
  return response.json();
};