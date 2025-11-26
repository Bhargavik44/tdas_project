import { poolPromise } from "./database.js";

async function seed() {
  try {
    const pool = await poolPromise;

    console.log("Seeding database...");

    //-----------------------------
    // 2️⃣ Create a Route
    //-----------------------------
    const driver1 = insertedUsers.find(u => u.username === "driver1");

    const routeResult = await pool.request()
      .input("routeName", "Route B")
      .input("driverID", driver1.userID)
      .query(`
        INSERT INTO driverRoutes (routeName, driverID)
        OUTPUT INSERTED.routeID
        VALUES (@routeName, @driverID)
      `);

    const routeID = routeResult.recordset[0].routeID;
    console.log("Route created:", routeID);


    //-----------------------------
    // 3️⃣ Insert Stops for the Route
    //-----------------------------
    const stops = [
      { stopName: "Pantaloons", arrivalTime: "6:40" },
      { stopName: "Skywalk", arrivalTime: "06:50" },
      { stopName: "Anna Arch", arrivalTime: "7:00" }
    ];

    let insertedStops = [];

    for (const s of stops) {
      const result = await pool.request()
        .input("routeID", routeID)
        .input("stopName", s.stopName)
        .input("arrivalTime", s.arrivalTime)
        .query(`
          INSERT INTO busStops (routeID, stopName, arrivalTime)
          OUTPUT INSERTED.stopID
          VALUES (@routeID, @stopName, @arrivalTime)
        `);

      insertedStops.push({ ...s, stopID: result.recordset[0].stopID });
    }

    console.log("Stops inserted:", insertedStops);


    //-----------------------------
    // 4️⃣ Assign students to stops
    //-----------------------------
    const student1 = insertedUsers.find(u => u.username === "student1");
    const student2 = insertedUsers.find(u => u.username === "student2");
    const student3 = insertedUsers.find(u => u.username === "student3");

    const assignData = [
      { userID: student1.userID, stopID: insertedStops[0].stopID }, // Main Gate
      { userID: student2.userID, stopID: insertedStops[1].stopID }, // Library
      { userID: student3.userID, stopID: insertedStops[2].stopID }  // Hostel
    ];

    for (const assign of assignData) {
      await pool.request()
        .input("userID", assign.userID)
        .input("routeID", routeID)
        .input("stopID", assign.stopID)
        .query(`
          INSERT INTO students_faculty (userID, routeID, stopID)
          VALUES (@userID, @routeID, @stopID)
        `);
    }

    console.log("Students assigned to route stops.");

    console.log("🎉 Seeding completed successfully!");
  } catch (err) {
    console.error("Seed error:", err);
  }
}

seed();