// ============================================================
// CANVAS & MAP DIMENSIONS
// Canvas is fixed at map resolution always.
// CSS scales it visually to fill the screen.
// ============================================================
const mapWidth = 1800;
const mapHeight = 1200;
let bg;

let dayArray = [];
let flightArray = [];
let pointCount = 0;

let daySelector = 0;
let flightSelector = 0;

let cnv;

// assetX/Y/W/H are now constants — canvas = map, always
const assetX        = 0;
const assetY        = 0;
const assetDisplayW = mapWidth;
const assetDisplayH = mapHeight;

// These are kept for compatibility but never change
let assetWidth  = mapWidth;
let assetHeight = mapHeight;
let assetRatio  = mapWidth / mapHeight;

const edges = {
    minLong: 68.44000,
    maxLong: 69.93296,
    minLat:  34.26000,
    maxLat:  34.906933,
}

let allFlights = {}
let currentFlight = null

let frameDelay = 0;
const SPEED = 1;

let trailsLayer;
let arrowLayer;

let lastFlightInfo = null;

let summaryMode = false;
let summaryTimer = 0;
const SUMMARY_DURATION = 30 * 60;

let lastValidX, lastValidY, prevValidX, prevValidY;

// ============================================================
// PRELOAD
// ============================================================
function preload() {
    bg = loadImage('assets/map_small.png');

    loadJSON("/data/allDays.json", function (days) {
        for (let d = 0; d < days.length; d++) {
            const day = days[d];
            let dayFlights = {}
            loadJSON(
                "/data/days/" + day.day + "_flights.json",
                function (flights_of_day) {
                    for (let f = 0; f < flights_of_day.length; f++) {
                        let flight = flights_of_day[f];
                        dayFlights[flight.flight_id] = flight
                        loadJSON("/data/flights/" + day.day + "/" + day.day + "_" + flight.flight_id + ".json", function (flight_data) {
                            dayFlights[flight.flight_id]["route"] = flight_data
                        })
                    }
                }
            )
            allFlights[day.day] = { flights: dayFlights }
        }
    });
}

// ============================================================
// SETUP
// Canvas is fixed at 1800×1200. CSS handles all visual scaling.
// No letterboxing math needed — coordinates are always stable.
// ============================================================
function setup() {
    cnv = createCanvas(mapWidth, mapHeight);
    cnv.parent('myContainer');
    background(bg);

    trailsLayer = createGraphics(mapWidth, mapHeight);
    arrowLayer  = createGraphics(mapWidth, mapHeight);

    for (var day in allFlights) {
        if (allFlights.hasOwnProperty(day)) {
            dayArray.push(day);
        }
    }
    for (let i = 0; i < dayArray.length; i++) {
        flightArray[i] = [];
        for (var flights in allFlights[dayArray[i]]['flights']) {
            if (allFlights[dayArray[i]]['flights'].hasOwnProperty(flights)) {
                flightArray[i].push(flights);
            }
        }
    }

    drawFlight();

    let totalPoints = 0;
    let totalFlights = 0;
    for (let d = 0; d < dayArray.length; d++) {
        for (let f = 0; f < flightArray[d].length; f++) {
            const flight = allFlights[dayArray[d]].flights[flightArray[d][f]];
            if (flight.route) {
                totalPoints += flight.route.length;
                totalFlights++;
            }
        }
    }
    console.log("Flights:", totalFlights);
    console.log("Total points:", totalPoints);
    console.log("Estimated time:", (totalPoints / 60 / 60).toFixed(1), "minutes");
}

// ============================================================
// GET FLIGHT DATA
// ============================================================
function getFlightData(day, id) {
    currentFlight = allFlights[day].flights[id];
    currentFlight._isLanding = isLanding(currentFlight.route);
    lastValidX = undefined;
    lastValidY = undefined;
    prevValidX = undefined;
    prevValidY = undefined;
}

// ============================================================
// DRAW FLIGHT
// ============================================================
function drawFlight() {
    if (flightSelector < flightArray[daySelector].length - 1) {
        flightSelector++;
    } else {
        flightSelector = 0;
        if (daySelector < dayArray.length - 1) {
            daySelector++;
            trailsLayer.clear();
            arrowLayer.clear();
            image(bg, 0, 0, mapWidth, mapHeight);
        } else {
            summaryMode = true;
            summaryTimer = 0;
            trailsLayer.clear();
            arrowLayer.clear();
            drawAllRoutes();
            return;
        }
    }
    getFlightData(dayArray[daySelector], flightArray[daySelector][flightSelector]);
}

// ============================================================
// IS LANDING
// ============================================================
function isLanding(route) {
    if (!route || route.length < 2) return false;

    const kabulPoints = route.filter(p =>
        p.longitude >= edges.minLong && p.longitude <= edges.maxLong &&
        p.latitude  >= edges.minLat  && p.latitude  <= edges.maxLat
    );

    if (kabulPoints.length < 4) return false;

    const quarter = Math.floor(kabulPoints.length / 4);

    let firstAvg = 0;
    for (let i = 0; i < quarter; i++) {
        firstAvg += kabulPoints[i].altitude || kabulPoints[i].alt || 0;
    }
    firstAvg /= quarter;

    let lastAvg = 0;
    for (let i = kabulPoints.length - quarter; i < kabulPoints.length; i++) {
        lastAvg += kabulPoints[i].altitude || kabulPoints[i].alt || 0;
    }
    lastAvg /= quarter;

    return lastAvg < firstAvg;
}

// ============================================================
// ALTITUDE COLOR
// ============================================================
function altitudeColor(altitude, landing) {
    const maxAlt = 12000;
    const t = constrain(altitude / maxAlt, 0, 1);

    if (landing) {
        return trailsLayer.color(
            lerp(60, 220, t),
            lerp(10, 50, t),
            lerp(10, 50, t)
        );
    } else {
        return trailsLayer.color(
            lerp(10, 50, t),
            lerp(50, 200, t),
            lerp(15, 80, t)
        );
    }
}

// ============================================================
// DRAW ALL ROUTES  (summary mode)
// ============================================================
function drawAllRoutes() {
    image(bg, 0, 0, mapWidth, mapHeight);

    for (let d = 0; d < dayArray.length; d++) {
        const day = dayArray[d];
        for (let id in allFlights[day].flights) {
            const flight = allFlights[day].flights[id];
            if (!flight.route || flight.route.length < 2) continue;

            const landing = flight._isLanding !== undefined
                ? flight._isLanding
                : isLanding(flight.route);

            trailsLayer.noFill();
            trailsLayer.strokeWeight(2);

            for (let i = 1; i < flight.route.length; i++) {
                const p    = flight.route[i];
                const prev = flight.route[i - 1];

                let x  = map(p.longitude,    edges.minLong, edges.maxLong, 0, mapWidth);
                let y  = map(p.latitude,     edges.maxLat,  edges.minLat,  0, mapHeight);
                let px = map(prev.longitude, edges.minLong, edges.maxLong, 0, mapWidth);
                let py = map(prev.latitude,  edges.maxLat,  edges.minLat,  0, mapHeight);

                if (x >= 0 && x <= mapWidth && y >= 0 && y <= mapHeight) {
                    let alt = p.altitude || p.alt || 0;
                    trailsLayer.stroke(altitudeColor(alt, landing));
                    trailsLayer.line(px, py, x, y);
                }
            }
        }
    }
    image(trailsLayer, 0, 0);
}

// ============================================================
// DRAW FLIGHT INFO
// ============================================================
function drawFlightInfo() {
    if (currentFlight && currentFlight.route && pointCount >= 1) {
        const routePoint = currentFlight.route[pointCount - 1];
        if (routePoint) {
            const raw = dayArray[daySelector];
            lastFlightInfo = {
                date:     raw.slice(6,8) + '-' + raw.slice(4,6) + '-' + raw.slice(0,4),
                callsign: currentFlight.callsign                          || "",
                flight:   currentFlight.flight                            || "",
                equip:    currentFlight.equip                             || "",
                from:     currentFlight.schd_from                         || "",
                to:       currentFlight.schd_to || currentFlight.real_to  || "",
                alt:      routePoint.altitude || routePoint.alt           || 0,
                heading:  routePoint.heading                              || "",
                speed:    (routePoint.speed                               || "") + " kt",
                lat:      nf(routePoint.latitude, 1, 5),
                lon:      nf(routePoint.longitude, 1, 5),
                squawk:   routePoint.squawk                               || "",
            };
        }
    }

    if (!lastFlightInfo) return;

    const lines = [
        ["DATE",     lastFlightInfo.date],
        ["CALLSIGN", lastFlightInfo.callsign],
        ["FLIGHT",   lastFlightInfo.flight],
        ["EQUIP",    lastFlightInfo.equip],
        ["FROM",     lastFlightInfo.from],
        ["TO",       lastFlightInfo.to],
        ["ALT",      lastFlightInfo.alt + " m"],
        ["HEADING",  lastFlightInfo.heading],
        ["SPEED",    lastFlightInfo.speed],
        ["LAT",      lastFlightInfo.lat],
        ["LON",      lastFlightInfo.lon],
        ["SQUAWK",   lastFlightInfo.squawk],
    ];

    const padding  = 12;
    const lineH    = 18;
    const colLabel = 80;
    const colValue = 130;
    const boxW     = colLabel + colValue + padding * 2;
    const boxH     = lines.length * lineH + padding * 2;

    noStroke();
    fill(0, 0, 0, 160);
    rect(10, 10, boxW, boxH, 4);

    textFont('monospace');
    textSize(12);
    for (let i = 0; i < lines.length; i++) {
        const yPos = 10 + padding + 12 + i * lineH;
        fill(180, 180, 180);
        text(lines[i][0], 10 + padding, yPos);
        fill(255);
        text(lines[i][1], 10 + padding + colLabel, yPos);
    }
}

// ============================================================
// DRAW — MAIN LOOP
// No letterbox math needed. All coords are in stable
// map-space (0→1800, 0→1200) at all times.
// ============================================================
function draw() {

    if (summaryMode) {
        summaryTimer++;
        if (summaryTimer >= SUMMARY_DURATION) {
            summaryMode    = false;
            summaryTimer   = 0;
            daySelector    = 0;
            flightSelector = 0;
            pointCount     = 0;
            frameDelay     = 0;
            lastFlightInfo = null;
            trailsLayer.clear();
            arrowLayer.clear();
            background(bg);
            drawFlight();
        }
        return;
    }

    if (currentFlight && currentFlight.route) {

        const landing     = currentFlight._isLanding;
        const flightColor = landing ? color(220, 50, 50) : color(50, 200, 80);

        if (pointCount < currentFlight.route.length) {

            if (pointCount >= 2) {
                const routePoint = currentFlight.route[pointCount - 1];
                const prevPoint  = currentFlight.route[pointCount - 2];

                let x  = map(routePoint.longitude, edges.minLong, edges.maxLong, 0, mapWidth);
                let y  = map(routePoint.latitude,  edges.maxLat,  edges.minLat,  0, mapHeight);
                let px = map(prevPoint.longitude,  edges.minLong, edges.maxLong, 0, mapWidth);
                let py = map(prevPoint.latitude,   edges.maxLat,  edges.minLat,  0, mapHeight);

                if (x >= 0 && x <= mapWidth && y >= 0 && y <= mapHeight) {
                    const alt = routePoint.altitude || routePoint.alt || 0;
                    trailsLayer.noFill();
                    trailsLayer.strokeWeight(2);
                    trailsLayer.stroke(altitudeColor(alt, landing));
                    trailsLayer.line(px, py, x, y);

                    prevValidX = lastValidX;
                    prevValidY = lastValidY;
                    lastValidX = x;
                    lastValidY = y;
                }
            }

            arrowLayer.clear();
            if (pointCount < currentFlight.route.length - 1 &&
                lastValidX !== undefined && prevValidX !== undefined) {
                const angle = atan2(lastValidY - prevValidY, lastValidX - prevValidX);
                const arrowSize = 10;
                arrowLayer.push();
                arrowLayer.translate(lastValidX, lastValidY);
                arrowLayer.rotate(angle);
                arrowLayer.fill(flightColor);
                arrowLayer.noStroke();
                arrowLayer.triangle(0, 0, -arrowSize, -arrowSize / 2, -arrowSize, arrowSize / 2);
                arrowLayer.pop();
            }

            image(bg, 0, 0, mapWidth, mapHeight);
            image(trailsLayer, 0, 0);
            image(arrowLayer, 0, 0);
            drawFlightInfo();

            frameDelay++;
            if (frameDelay >= SPEED) {
                pointCount++;
                frameDelay = 0;
            }

        } else {
            pointCount = 0;
            frameDelay = 0;
            drawFlight();
        }
    }
}

// ============================================================
// KEY CONTROLS
// SPACE fullscreens the container div — the canvas stays
// fixed at 1800×1200 and CSS letterboxes it automatically
// ============================================================
function keyPressed() {
    if (keyCode == 32) {
        const el = document.getElementById('myContainer');
        if (!document.fullscreenElement) {
            el.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }
    if (key == 's' || key == 'S') {
        daySelector    = dayArray.length - 1;
        flightSelector = 0;
        pointCount     = 0;
        frameDelay     = 0;
        summaryMode    = false;
        summaryTimer   = 0;
        trailsLayer.clear();
        arrowLayer.clear();
        image(bg, 0, 0, mapWidth, mapHeight);
        getFlightData(dayArray[daySelector], flightArray[daySelector][0]);
    }
    if (key == 'r' || key == 'R') {
        daySelector    = 0;
        flightSelector = 0;
        pointCount     = 0;
        frameDelay     = 0;
        summaryMode    = false;
        summaryTimer   = 0;
        lastFlightInfo = null;
        trailsLayer.clear();
        arrowLayer.clear();
        background(bg);
        getFlightData(dayArray[0], flightArray[0][0]);
    }
}

// ============================================================
// WINDOW RESIZED
// Canvas stays fixed — nothing to do here.
// CSS handles all visual scaling automatically.
// ============================================================
function windowResized() {
    // intentionally empty
}
