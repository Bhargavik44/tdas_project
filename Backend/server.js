import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import sql from "mssql";
import { poolPromise, initializeTables } from "./database.js";
import { sendSms } from "./sendSms.js";

dotenv.config();
const app = express();

// ✅ Always place this before any route definitions
app.use(cors({
  origin: ["http://localhost:3000", "https://your-frontend-domain-if-deployed.com"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));
app.use(express.json());

// Initialize DB tables (optional)
initializeTables();

// ✅ LOGIN
app.post("/login", async (req, res) => {
  const { mobileNo, password, role } = req.body;
  if (!mobileNo || !password || !role)
    return res.status(400).json({ message: "All fields are required" });

  try {
    const pool = await poolPromise;

    // Check credentials
    const result = await pool.request()
      .input("mobileNo", mobileNo)
      .input("password", password)
      .input("role", role)
      .query(`
        SELECT * FROM users
        WHERE mobileNo = @mobileNo AND password = @password AND role = @role
      `);

    const user = result.recordset[0];
    if (!user)
      return res.status(401).json({ message: "Invalid credentials" });

    const loginTime = new Date();
    await pool.request()
      .input("loginTime", loginTime)
      .input("userID", user.userID)
      .query(`
        UPDATE users
        SET login_timestamp = @loginTime
        WHERE userID = @userID
      `);

    res.json({
      userID: user.userID,
      mobileNo: user.mobileNo,
      username: user.username,
      role: user.role,
      login_timestamp: loginTime,
    });

  } catch (err) {
    console.error("DB Error:", err.message);
    res.status(500).json({ message: "DB Error" });
  }
});

// ✅ LOGOUT
app.post("/logout", async (req, res) => {
  const { id } = req.body;
  const logoutTime = new Date();

  try {
    const pool = await poolPromise;
    await pool.request()
      .input("logoutTime", logoutTime)
      .input("userID", id)
      .query(`
        UPDATE users
        SET logout_timestamp = @logoutTime
        WHERE userID = @userID
      `);

    res.json({ message: "Logout recorded", logout_timestamp: logoutTime });
  } catch (err) {
    console.error("DB Error:", err.message);
    res.status(500).json({ message: "DB Error" });
  }
});

// ✅ GET ALL DRIVERS
app.get("/drivers", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT userID, username, mobileNo FROM users WHERE role = 'driver'
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("DB Error:", err.message);
    res.status(500).json({ message: "DB Error" });
  }
});

// ✅ GET ALL ROUTES
app.get("/routes", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT routeID, routeName, driverID FROM driverRoutes
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("DB Error:", err.message);
    res.status(500).json({ message: "DB Error" });
  }
});

// ✅ GET BUS STOPS FOR ROUTE
app.get("/bus-stops/:routeID", async (req, res) => {
  const { routeID } = req.params;

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("routeID", routeID)
      .query(`
        SELECT stopID, stopName, arrivalTime
        FROM busStops
        WHERE routeID = @routeID
        ORDER BY arrivalTime ASC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error("DB Error:", err.message);
    res.status(500).json({ message: "DB Error" });
  }
});

// -------------------ADMIN ROUTES-------------------
// ✅ ADD DRIVER
app.post("/addDriver", async (req, res) => {
  const { username, mobileNo } = req.body;
  const defaultPassword = "driver123";

  if (!username || !mobileNo) {
    return res.status(400).json({ message: "Username and mobile are required" });
  }

  try {
    const pool = await poolPromise;
    await pool.request()
      .input("username", username)
      .input("mobileNo", mobileNo)
      .input("password", defaultPassword)
      .query(`
        INSERT INTO users (username, mobileNo, role, password)
        VALUES (@username, @mobileNo, 'driver', @password)
      `);

    res.json({ message: "Driver added successfully" });
  } catch (err) {
    console.error("DB Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ✅ ADD ROUTE
app.post("/add-route", async (req, res) => {
  const { routeName, numStops } = req.body;

  if (!routeName)
    return res.status(400).json({ message: "Route name is required" });

  try {
    const pool = await poolPromise;
    await pool.request()
      .input("routeName", routeName)
      .input("numStops", numStops || 0)
      .query(`
        INSERT INTO driverRoutes (routeName, numStops)
        VALUES (@routeName, @numStops)
      `);

    res.json({ message: "✅ Route added successfully" });
  } catch (err) {
    console.error("DB Error:", err.message);
    res.status(500).json({ message: "DB Error" });
  }
});

// ✅ ASSIGN DRIVER TO ROUTE
app.post("/assign-driver", async (req, res) => {
  const { routeID, driverID } = req.body;

  try {
    const pool = await poolPromise;
    await pool.request()
      .input("routeID", routeID)
      .input("driverID", driverID)
      .query(`
        UPDATE driverRoutes
        SET driverID = @driverID
        WHERE routeID = @routeID
      `);

    res.json({ message: "Driver assigned successfully" });
  } catch (err) {
    console.error("DB Error:", err.message);
    res.status(500).json({ message: "DB Error" });
  }
});

// ✅ ADD BUS STOP
app.post("/add-bus-stop", async (req, res) => {
  const { routeID, stopName, arrivalTime } = req.body;

  // Basic validation
  if (!routeID || !stopName || arrivalTime === undefined) {
    return res.status(400).json({ message: "routeID, stopName and arrivalTime are required" });
  }

  const routeIDInt = parseInt(routeID, 10);
  if (Number.isNaN(routeIDInt)) {
    return res.status(400).json({ message: "routeID must be a number" });
  }

  try {
    const pool = await poolPromise;

    // Check route exists
    const routeCheck = await pool.request()
      .input("routeID", sql.Int, routeIDInt)
      .query(`SELECT routeID FROM driverRoutes WHERE routeID = @routeID`);

    if (!routeCheck.recordset || routeCheck.recordset.length === 0) {
      return res.status(400).json({ message: "Route not found" });
    }

    await pool.request()
      .input("routeID", sql.Int, routeIDInt)
      .input("stopName", sql.NVarChar(100), stopName)
      .input("arrivalTime", sql.NVarChar(50), arrivalTime)
      .query(`
        INSERT INTO busStops (routeID, stopName, arrivalTime )
        VALUES (@routeID, @stopName, @arrivalTime)
      `);

    res.json({ message: "Bus stop added successfully" });
  } catch (err) {
    console.error("DB Error adding bus stop:", err);
    res.status(500).json({ message: "DB Error adding bus stop", error: err.message });
  }
});

// ✅ REMOVE BUS STOP
app.delete("/remove-bus-stop/:stopID", async (req, res) => {
  const { stopID } = req.params;

  try {
    const pool = await poolPromise;
    await pool.request()
      .input("stopID", stopID)
      .query(`
        DELETE FROM busStops WHERE stopID = @stopID
      `);

    res.json({ message: "Bus stop removed" });
  } catch (err) {
    console.error("DB Error:", err.message);
    res.status(500).json({ message: "DB Error" });
  }
});

// ✅ CHANGE DRIVER FOR ROUTE
app.post("/change-driver", async (req, res) => {
  const { routeID, newDriverID } = req.body;

  try {
    const pool = await poolPromise;
    await pool.request()
      .input("routeID", routeID)
      .input("newDriverID", newDriverID)
      .query(`
        UPDATE driverRoutes
        SET driverID = @newDriverID
        WHERE routeID = @routeID
      `);

    res.json({ message: "Driver changed successfully" });
  } catch (err) {
    console.error("DB Error:", err.message);
    res.status(500).json({ message: "DB Error" });
  }
});

// ✅ DRIVER ROUTE + STOPS
app.get("/driver-route/:driverID", async (req, res) => {
  const { driverID } = req.params;

  try {
    const pool = await poolPromise;

    const routeResult = await pool.request()
      .input("driverID", driverID)
      .query(`
        SELECT * FROM driverRoutes WHERE driverID = @driverID
      `);

    const route = routeResult.recordset[0];
    if (!route)
      return res.status(404).json({ message: "No route assigned" });

    const stopsResult = await pool.request()
      .input("routeID", route.routeID)
      .query(`
        SELECT stopID, stopName, arrivalTime
        FROM busStops
        WHERE routeID = @routeID
        ORDER BY arrivalTime ASC
      `);

    res.json({
      routeName: route.routeName,
      busStops: stopsResult.recordset,
    });

  } catch (err) {
    console.error("DB Error:", err.message);
    res.status(500).json({ message: "DB Error" });
  }
});

// -------------------------DRIVER-------------------------
// ✅ ARRIVAL LOGGING AND DELAY CALCULATION
app.post("/arrive", async (req, res) => {
  const { stopID, driverID } = req.body;

  if (!stopID || !driverID) {
    return res.status(400).json({ message: "stopID and driverID are required" });
  }

  try {
    const pool = await poolPromise;

    // Get stop info and route
    const stopResult = await pool.request()
      .input("stopID", stopID)
      .query(`
        SELECT bs.stopID, bs.routeID, bs.stopName, bs.arrivalTime
        FROM busStops bs
        WHERE bs.stopID = @stopID
      `);

    const stop = stopResult.recordset[0];
    if (!stop) return res.status(404).json({ message: "Stop not found" });

    // Compute delay (basic): compare now vs scheduled arrival (assumes HH:mm format)
    const now = new Date();
    const scheduled = stop.arrivalTime;

    let delayMinutes = 0;
    if (scheduled) {
      const [hh, mm] = String(scheduled).split(":");
      if (!isNaN(hh) && !isNaN(mm)) {
        const scheduledDate = new Date(now);
        scheduledDate.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
        delayMinutes = Math.max(0, Math.round((now.getTime() - scheduledDate.getTime()) / 60000));
      }
    }

    const threshold = process.env.DELAY_MINUTES_THRESHOLD;
    const status = delayMinutes > threshold ? "Delayed" : "On time";

    // Insert arrival record
    await pool.request()
      .input("routeID", stop.routeID)
      .input("stopID", stop.stopID)
      .input("driverID", driverID)
      .input("scheduledArrival", scheduled || null)
      .input("delayMinutes", delayMinutes)
      .input("status", status)
      .query(`
        INSERT INTO arrivals (routeID, stopID, driverID, scheduledArrival, actualArrival, delayMinutes, status)
        VALUES (@routeID, @stopID, @driverID, @scheduledArrival, GETDATE(), @delayMinutes, @status)
      `);

    // Minimal notification dispatcher placeholder
    if (delayMinutes > threshold) {
      console.log(
        `Dispatcher: Route ${stop.routeID}, Stop ${stop.stopName} delayed by ${delayMinutes} mins.`
      );
    }

    res.json({ delayMinutes, status, threshold, routeID: stop.routeID, stopID: stop.stopID });
  } catch (err) {
    console.error("DB Error:", err.message);
    res.status(500).json({ message: "DB Error" });
  }
});

// Alert SMS Notification
app.post("/send-sms", async (req, res) => {
  const { routeID, stopID, delayMinutes } = req.body;

  if (!routeID || !stopID || !delayMinutes) {
    return res.status(400).json({ message: "routeID, stopID, delayMinutes required" });
  }

  try {
    const pool = await poolPromise;

    // 1️⃣ Get all stops + routeName from busStops
    const stopsResult = await pool.request()
      .input("routeID", routeID)
      .query(`
        SELECT stopID, stopName, arrivalTime
        FROM busStops
        WHERE routeID = @routeID
        ORDER BY arrivalTime ASC
      `);

    const stops = stopsResult.recordset;
    if (stops.length === 0) {
      return res.status(404).json({ message: "No stops found for this routeID" });
    }

    // 2️⃣ Determine remaining stops
    const currentIndex = stops.findIndex(s => s.stopID === stopID);
    const remainingStops = stops.slice(currentIndex + 1);

    if (remainingStops.length === 0) {
      return res.json({ message: "No upcoming stops, no SMS sent." });
    }

    // 3️⃣ Get phone numbers using routeName + remaining stopNames
    const phonesResult = await pool.request()
      .input("routeID", routeID)
      .query(`
        SELECT u.mobileNo
        FROM students_faculty sf
        JOIN users u ON u.userID = sf.userID
        WHERE sf.routeID = @routeID
        AND sf.stopID IN (${remainingStops.map(s => s.stopID).join(",")})
      `);

    const numbers = phonesResult.recordset.map(r => r.mobileNo);

    if (numbers.length === 0) {
      return res.json({ message: "No students/faculties assigned to upcoming stops." });
    }

    // 4️⃣ Send SMS using Azure
    for (const num of numbers) {
      const formattedNumber = "+91" + num;
      await sendSms(
        formattedNumber,
        `Bus Delay Alert: Your bus is delayed by ${delayMinutes} minutes.`
      );
    }

    res.json({
      message: "SMS sent successfully.",
      sentTo: numbers
    });

  } catch (err) {
    console.error("SMS API Error:", err);
    res.status(500).json({ message: "SMS sending failed", error: err.message });
  }
});

// -----------------------SUBSCRIBER ROUTES-----------------------
// ✅ REPORT LATE (from student/faculty when no notification received)
app.post("/report-late", async (req, res) => {
  try {
    const { routeName, stopName, mobileNo, note } = req.body;
    if (!routeName || !stopName || !mobileNo) {
      return res.status(400).json({ message: "routeName, stopName, mobileNo are required" });
    }

    // Heuristic "GenAI" placeholder: determine affected downstream stops and reason
    const reason = "Possible congestion due to traffic or signal delays";

    // Find routeID and stops
    const pool = await poolPromise;
    const routeRes = await pool.request().query(`
      SELECT routeID FROM driverRoutes WHERE routeName = '${routeName.replace(/'/g, "''")}'
    `);
    const route = routeRes.recordset[0];
    if (!route) return res.status(404).json({ message: "Route not found" });

    const stopsRes = await pool.request()
      .input("routeID", route.routeID)
      .query(`
        SELECT stopID, stopName, arrivalTime
        FROM busStops
        WHERE routeID = @routeID
        ORDER BY arrivalTime ASC
      `);

    const stops = stopsRes.recordset || [];
    const currentIdx = stops.findIndex(s => s.stopName === stopName);
    const affectedStops = currentIdx >= 0 ? stops.slice(currentIdx).map(s => s.stopName) : stops.map(s => s.stopName);

    console.log(
      `ReportLate Dispatcher: Route ${routeName}, from stop ${stopName}. Affected stops: ${affectedStops.join(", ")}. Reason: ${reason}. (Would send SMS here)`
    );

    res.json({ message: "Report received", reason, affectedStops });
  } catch (err) {
    console.error("DB Error:", err.message);
    res.status(500).json({ message: "DB Error" });
  }
});

app.post("/subscribers", async (req, res) => {
  const { userID, mobileNo, routeID, stopID } = req.body;

  try {
    const pool = await poolPromise;

    // Update user's mobile number
    await pool.request()
      .input("userID", userID)
      .input("mobileNo", mobileNo)
      .query(`
        UPDATE users SET mobileNo = @mobileNo WHERE userID = @userID
      `);

    // Check if subscriber exists
    const exists = await pool.request()
      .input("userID", userID)
      .query(`SELECT id FROM students_faculty WHERE userID = @userID`);

    if (exists.recordset.length > 0) {
      const routeIDInt = routeID ? parseInt(routeID, 10) : null;
      const stopIDInt = stopID ? parseInt(stopID, 10) : null;

      await pool.request()
        .input("userID", userID)
        .input("routeID", routeIDInt)
        .input("stopID", stopIDInt)
        .query(`
          UPDATE students_faculty
          SET routeID = @routeID, stopID = @stopID
          WHERE userID = @userID
        `);

      return res.json({ message: "Subscription updated" });
    }

    // Insert new subscription
    await pool.request()
      .input("userID", userID)
      .input("routeID", routeID)
      .input("stopID", stopID)
      .query(`
        INSERT INTO students_faculty (userID, routeID, stopID)
        VALUES (@userID, @routeID, @stopID)
      `);

    res.json({ message: "Subscribed successfully" });
  } catch (err) {
    res.status(500).json({ message: "DB Error", error: err.message });
  }
});

// ✅ GET LATE ARRIVALS LOG (for admin)
app.get("/arrivals/late", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT a.arrivalID, a.actualArrival, a.delayMinutes, a.status,
             u.userID, u.username,
             bs.stopID, bs.stopName,
             dr.routeID, dr.routeName
      FROM arrivals a
      JOIN users u ON u.userID = a.driverID
      JOIN busStops bs ON bs.stopID = a.stopID
      JOIN driverRoutes dr ON dr.routeID = a.routeID
      WHERE a.status = 'Delayed'
      ORDER BY a.actualArrival DESC
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error("DB Error fetching late arrivals:", err.message);
    res.status(500).json({ message: "DB Error" });
  }
});

// GET SUBSCRIBER BY MOBILE (legacy)
app.get("/subscribers/:mobileNo", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("mobileNo", req.params.mobileNo)
      .query(`SELECT id, name, routeName, stopName, mobileNo FROM students_faculty WHERE mobileNo = @mobileNo`);
    if (result.recordset.length === 0) return res.status(404).json({ message: "Not found" });
    res.json(result.recordset[0]);
  } catch (err) {
    console.error("DB Error:", err.message);
    res.status(500).json({ message: "DB Error" });
  }
});

app.get("/subscriber/:userID", async (req, res) => {
  try {
    const pool = await poolPromise;
    const userId = parseInt(req.params.userID, 10);

    const result = await pool.request()
      .input("userID", userId)
      .query(`
        SELECT 
          u.userID,
          u.username AS name,
          u.mobileNo,
          sf.routeID,
          sf.stopID,
          dr.routeName,
          bs.stopName
        FROM users u
        LEFT JOIN students_faculty sf ON sf.userID = u.userID
        LEFT JOIN driverRoutes dr ON dr.routeID = sf.routeID
        LEFT JOIN busStops bs ON bs.stopID = sf.stopID
        WHERE u.userID = @userID
      `);

    if (result.recordset.length === 0)
      return res.status(404).json({ message: "User not found" });

    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ message: "DB Error", error: err.message });
  }
});


// --------------------- SERVER START ---------------------
const PORT = process.env.PORT;
app.listen(PORT, () =>
  console.log(`🚀 Server running on ${PORT}`)
);