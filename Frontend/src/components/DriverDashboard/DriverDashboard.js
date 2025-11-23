import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../../utils/api";

function DriverDashboard() {
  const navigate = useNavigate();
  const [routeName, setRouteName] = useState("");
  const [busStops, setBusStops] = useState([]);
  const [alertMessage, setAlertMessage] = useState("");
  const [arrivedStopIds, setArrivedStopIds] = useState(() => {
    try {
      const raw = localStorage.getItem("arrivedStopIds");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [driverName, setDriverName] = useState("");
  const driverID = useMemo(() => localStorage.getItem("userID"), []);
  const role = useMemo(() => localStorage.getItem("role"), []);

  useEffect(() => {
    const fetchDriverName = async () => {
      try {
        const res = await fetch(`${API_BASE}/drivers`);
        const drivers = await res.json();
        const me = drivers.find((d) => String(d.userID) === String(driverID));
        if (me) setDriverName(me.username);
      } catch (e) {
        console.error("Failed to fetch driver name", e);
      }
    };

    const fetchRoute = async () => {
      try {
        const res = await fetch(`${API_BASE}/driver-route/${driverID}`);
        if (!res.ok) throw new Error("No route assigned");
        const data = await res.json();
        setRouteName(data.routeName);
        setBusStops(data.busStops);
      } catch (err) {
        console.error(err);
        alert("Error fetching route data. Please contact admin.");
      }
    };

    if (driverID && role === "driver") {
      fetchDriverName();
      fetchRoute();
    } else {
      navigate("/");
    }
  }, [driverID, role, navigate]);

  const handleArrived = async (stop) => {
    try {
      const res = await fetch(`${API_BASE}/arrive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stopID: stop.stopID, driverID })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Arrival failed");
      const message = data.delayMinutes > data.threshold
        ? `⚠️ Delay detected: ${data.delayMinutes} mins late at ${stop.stopName}.`
        : `✅ Arrived at ${stop.stopName} on time.`;
      setAlertMessage(message);
      
      const next = Array.from(new Set([...(arrivedStopIds || []), stop.stopID]));
      setArrivedStopIds(next);
      localStorage.setItem("arrivedStopIds", JSON.stringify(next));

      if (data.status == "Delayed") {
        console.log("Sending SMS notification...");

        await fetch(`${API_BASE}/send-sms`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            routeID: data.routeID,
            stopID: data.stopID,
            delayMinutes: data.delayMinutes
          })
        });
      }
    } catch (e) {
      console.error(e);
      alert("Failed to record arrival. Please try again.");
    }
  };

  const handleLogout = async () => {
    try {
      const userId = JSON.parse(localStorage.getItem("userId"));
      if (!userId) {
        navigate("/");
        return;
      }

      await fetch(`${API_BASE}/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId }),
      });

      localStorage.removeItem("userId");
      localStorage.removeItem("role");
      navigate("/");
    } catch (err) {
      console.error("Logout failed:", err);
      alert("Logout failed. Please try again.");
    }
  };

  return (
    <div style={{ padding: "0", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Navbar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.75rem 1rem",
        backgroundColor: "#0d47a1",
        color: "#fff"
      }}>
        <div style={{ fontWeight: 600 }}>Driver: {driverName || driverID}</div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => alert("Profile coming soon")}
            style={{ background: "#1976d2", color: "#fff", border: "none", padding: "0.4rem 0.8rem", borderRadius: 4, cursor: "pointer" }}
          >
            Profile
          </button>
          <button
            onClick={handleLogout}
            style={{ background: "#d32f2f", color: "#fff", border: "none", padding: "0.4rem 0.8rem", borderRadius: 4, cursor: "pointer" }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "1rem", flex: 1 }}>
        <h2 style={{ marginTop: 0 }}>🚍 Driver Dashboard</h2>
        <h3>Route: {routeName || "—"}</h3>

        <div id="stopsSection" style={{ marginTop: "1rem" }}>
          <h3>Your Route Stops</h3>
          {busStops.length > 0 ? (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {busStops.map((stop, idx) => (
                <div key={idx} style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.75rem 1rem",
                  border: "1px solid #e0e0e0",
                  borderRadius: 6
                }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{stop.stopName}</div>
                    <div style={{ color: "#555", fontSize: 14 }}>Scheduled arrival: {stop.arrivalTime}{stop.departureTime ? ` • Departure: ${stop.departureTime}` : ""}</div>
                  </div>
                  <button
                    onClick={() => handleArrived(stop)}
                    disabled={(arrivedStopIds || []).includes(stop.stopID)}
                    style={{ background: (arrivedStopIds || []).includes(stop.stopID) ? "#9e9e9e" : "#2e7d32", color: "#fff", border: "none", padding: "0.5rem 0.9rem", borderRadius: 4, cursor: (arrivedStopIds || []).includes(stop.stopID) ? "not-allowed" : "pointer" }}
                  >
                    {(arrivedStopIds || []).includes(stop.stopID) ? "Arrived" : "Arrived"}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p>No bus stops assigned yet.</p>
          )}
        </div>

        {alertMessage && (
          <div id="alertSection" style={{ marginTop: "1rem", color: "#b71c1c" }}>
            <h3 style={{ marginTop: 0 }}>📢 Arrival Status:</h3>
            <p>{alertMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default DriverDashboard;