const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();

app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(-1);
  }
};
initializeDBAndServer();

//
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "adouasjdansjd", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;

        next();
      }
    });
  }
};

const convertDistrictDbObjectToResponseObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

const convertStateDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

//login//
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
    SELECT
      *
    FROM
      user
    WHERE 
      username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "adouasjdansjd");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//states//
app.get("/states/", authenticateToken, async (request, response) => {
  getStatesQuery = `
    SELECT *
    FROM state`;
  statesArray = await db.all(getStatesQuery);
  // response.send(statesArray);
  response.send(
    statesArray.map((eachState) =>
      convertStateDbObjectToResponseObject(eachState)
    )
  );
});

//states/stateId

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  getStatesQuery = `
    SELECT *
    FROM state
    where state_id='${stateId}'`;

  statedetails = await db.get(getStatesQuery);

  response.send(convertStateDbObjectToResponseObject(statedetails));
});

//createD
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addDistrictQuery = `
    INSERT INTO 
    DISTRICT (district_name,state_id,cases,cured,active,deaths)
    VALUES
    (
      '${districtName}',
       ${stateId},
       ${cases},
       ${cured},
       ${active},
       ${deaths}
    ) ;`;
  const district = await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

//districts/districtId
app.get(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    SELECT *
    FROM district
    WHERE
    district_id='${districtId}';`;
    const districtdetails = await db.get(getDistrictQuery);
    response.send(convertDistrictDbObjectToResponseObject(districtdetails));
  }
);

//deleteDistrict
app.delete(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const DeleteQuery = `
    DELETE FROM 
    district
    where
    district_id='${districtId}';`;
    await db.run(DeleteQuery);
    response.send("District Removed");
  }
);

//put/districts/:districtId/
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const { districtId } = request.params;
    const updateQuery = `
UPDATE
district
SET
district_name = '${districtName}',
state_id = ${stateId},
cases = ${cases},
cured=${cured},
active=${active},
deaths=${deaths}
WHERE
district_id = ${districtId};`;

    await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

//get/states/:stateId/stats/
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getstatestatQuery = `
SELECT
 SUM(cases) as totalCases,
 SUM(cured) as totalCured,
 SUM(active) as totalActive ,
 SUM(deaths) as totalDeaths
FROM
   district
WHERE
  state_id=${stateId};`;
    const stats = await db.get(getstatestatQuery);

    response.send(stats);
  }
);

module.exports = app;
