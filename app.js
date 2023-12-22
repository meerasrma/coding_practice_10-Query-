const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();

app.use(express.json());

let db = null;

const convertDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictDbObjectToResponseObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cases,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server is Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(-1);
  }
};
initializeDBAndServer();

// const logger = (request, response, next) => {
//   console.log(request.query);
//   next();
// };

// API 1
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (authHeader === undefined) {
    response.status(401).send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "my_secret_token", async (error, payload) => {
      if (error) {
        response.status(401).send("Invalid JWT Token");
      } else {
        // request.username = payload.username;
        next();
      }
    });
  }
};

// API 1
// Get Login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
    SELECT *
    FROM user
    WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);

    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "my_secret_token");
      response.send({ jwtToken });
    } else {
      response.status(400).send("Invalid password");
    }
  }
});

// API 2
app.get("/states/", authenticateToken, async (request, response) => {
  const selectStatesQuery = `
    SELECT *
    FROM state
    `;
  const stateArray = await db.all(selectStatesQuery);
  response.send(
    stateArray.map((eachState) => convertDbObjectToResponseObject(eachState))
  );
});

//API 3
app.get("/states/:stateId", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const selectStateQuery = `
    SELECT*
    FROM state
    WHERE state_id = ${stateId}`;

  const stateResponse = await db.get(selectStateQuery);
  response.send(convertDbObjectToResponseObject(stateResponse));
});

// API 5
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const selectDistrictQuery = `
    SELECT 
        *
    FROM district
    WHERE district_id = ${districtId}`;

    const districtResponse = await db.get(selectDistrictQuery);
    response.send(convertDistrictDbObjectToResponseObject(districtResponse));
  }
);

// API 4
// Create a district in District table
app.post("/districts/", authenticateToken, async (request, response) => {
  const { stateId, districtName, cases, cured, active, deaths } = request.body;
  const addDistrictQuery = `
    INSERT INTO
    district (state_id,district_name, cases, cured, active, deaths)
    VALUES(
    ${stateId},
    '${districtName}',
    ${cases},
    ${cured},
    ${active},
    ${deaths}    )`;
  await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

// API 6
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const removeDistrictQuery = `
    DELETE 
    FROM district
    WHERE district_id = ${districtId}`;
    await db.run(removeDistrictQuery);
    response.send("District Removed");
  }
);

// API 7
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;

    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;

    const updateDistrictQuery = `
    UPDATE district
    SET
        district_name = '${districtName}',
        state_id = ${stateId},
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths}
    WHERE 
        district_id = ${districtId}`;

    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

// API 8
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;

    const totalStatisticsQuery = `
        SELECT
            SUM(cases) as totalCases,
            SUM(cured) as totalCured,
            SUM(active) as totalActive,
            SUM(deaths) as totalDeaths
        FROM district
        WHERE
            state_id = ${stateId}`;
    const totalStatsResponse = await db.get(totalStatisticsQuery);
    response.send(totalStatsResponse);
  }
);

module.exports = app;
