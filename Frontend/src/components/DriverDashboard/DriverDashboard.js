import React, { useEffect, useMemo, useState } from "react";
import './DriverDashboard.css';
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../../utils/api";

function DriverDashboard() {
  const navigate = useNavigate();
  const [routeName, setRouteName] = useState("");
  const [busStops, setBusStops] = useState([]);
  const [alertMessage, setAlertMessage] = useState("");
  const [routeStatusMsg, setRouteStatusMsg] = useState("");
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
        setRouteStatusMsg("");
        const res = await fetch(`${API_BASE}/driver-route/${driverID}`);
        if (res.status === 404) {
          // No route assigned to this driver
          setRouteName("");
          setBusStops([]);
          setRouteStatusMsg("Contact Transport Department to assign you any route for the day");
          return;
        }

        if (!res.ok) throw new Error("Failed to fetch route");

        const data = await res.json();
        setRouteName(data.routeName);
        setBusStops(data.busStops || []);

        if (!data.busStops || data.busStops.length === 0) {
          setRouteStatusMsg("Contact your Transport Department to assign bus stops for your route");
        } else {
          setRouteStatusMsg("");
        }
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

      if (data.status === "Delayed") {
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
    <div className="driver-dashboard">
      {/* Navbar */}
      <div className="dd-navbar">
        <div className="driver-name">Driver: {driverName || driverID}</div>
        <div className="nav-actions">
          <button onClick={() => alert("Profile coming soon")} className="dd-btn dd-btn-profile">Profile</button>
          <button onClick={handleLogout} className="dd-btn dd-btn-logout">Logout</button>
        </div>
      </div>

      {/* Content */}
      <div className="dd-content">
        <div className="dd-header">
          <div>
            <h2>🚍 Driver Dashboard</h2>
            <div className="route-name">Route: {routeName || "—"}</div>
          </div>
        </div>

        <div id="stopsSection">
          <h3>Your Route Stops</h3>
          {busStops.length > 0 ? (
            <div className="stops-grid">
              {busStops.map((stop, idx) => (
                <div key={idx} className="stop-card">
                  <div className="stop-meta">
                    <div className="stop-name">{stop.stopName}</div>
                    <div className="stop-time">Scheduled arrival: {stop.arrivalTime}</div>
                  </div>
                  <button
                    onClick={() => handleArrived(stop)}
                    disabled={(arrivedStopIds || []).includes(stop.stopID)}
                    className={`stop-btn ${ (arrivedStopIds || []).includes(stop.stopID) ? 'disabled' : '' }`}
                  >
                    {(arrivedStopIds || []).includes(stop.stopID) ? "Arrived" : "Mark Arrived"}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">{routeStatusMsg || "No bus stops assigned yet."}</p>
          )}
        </div>

        {alertMessage && (
          <div id="alertSection" className="alert-section">
            <h3 style={{ marginTop: 0 }}>📢 Arrival Status:</h3>
            <p>{alertMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default DriverDashboard;