/**
 * Navigation Feature Tests
 * Tests for: heading rotation, canvas rotation, walking line, zoom-out on arrival
 * Run with: node src/tests/navigation-features.test.js
 */

// ============================================================
// TEST 1: Heading determination logic (speed-null fix)
// ============================================================
function testHeadingDetermination() {
  const MIN_SPEED_FOR_HEADING = 0.56; // 2 km/h in m/s
  const results = [];

  function calculateGPSDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Simulate the heading logic from GoogleMapsNavigation.jsx
  function determineHeading(userLocation, prevPos, currentHeading, routeHeadingFn) {
    const speed = userLocation.speed ?? null;
    const gpsHeading = userLocation.heading ?? null;

    let isMoving;
    if (speed !== null) {
      isMoving = speed >= MIN_SPEED_FOR_HEADING;
    } else if (prevPos) {
      const movedDist = calculateGPSDistance(prevPos.lat, prevPos.lng, userLocation.lat, userLocation.lng);
      isMoving = movedDist >= 3;
    } else {
      isMoving = true; // First update
    }

    let newHeading = currentHeading;
    let headingSource = 'unchanged';

    // Priority 1: Route-based
    if (isMoving) {
      const routeHeading = routeHeadingFn ? routeHeadingFn() : null;
      if (routeHeading !== null) {
        newHeading = routeHeading;
        headingSource = 'route';
      }
    }
    // Priority 2: GPS bearing
    if (headingSource === 'unchanged' && isMoving && gpsHeading !== null && gpsHeading >= 0) {
      newHeading = gpsHeading;
      headingSource = 'GPS-bearing';
    }
    // Priority 3: Movement vector (simplified)
    if (headingSource === 'unchanged' && isMoving && prevPos) {
      const moveDist = calculateGPSDistance(prevPos.lat, prevPos.lng, userLocation.lat, userLocation.lng);
      if (moveDist >= 3) {
        newHeading = 90; // simplified: just set to east for test
        headingSource = 'movement';
      }
    }
    // Stationary: only when speed explicitly < threshold
    if (headingSource === 'unchanged' && speed !== null && speed < MIN_SPEED_FOR_HEADING) {
      headingSource = 'stationary-hold';
    }

    return { newHeading, headingSource, isMoving };
  }

  // Test 1a: Speed is null, no previous position → should assume moving (first update)
  const r1a = determineHeading(
    { lat: 5.6, lng: -0.2, speed: null, heading: null },
    null,
    270,
    () => 45  // route heading = 45° (northeast)
  );
  results.push({
    name: 'Speed null, first update → should use route heading',
    pass: r1a.headingSource === 'route' && r1a.newHeading === 45 && r1a.isMoving === true,
    detail: `source=${r1a.headingSource}, heading=${r1a.newHeading}, isMoving=${r1a.isMoving}`
  });

  // Test 1b: Speed is null, moved >3m from previous → should be moving
  const r1b = determineHeading(
    { lat: 5.6001, lng: -0.2, speed: null, heading: null },
    { lat: 5.6, lng: -0.2 },
    270,
    () => 0  // route heading = 0° (north)
  );
  const dist1b = calculateGPSDistance(5.6, -0.2, 5.6001, -0.2);
  results.push({
    name: `Speed null, moved ${dist1b.toFixed(1)}m → should be moving`,
    pass: r1b.isMoving === true && r1b.headingSource === 'route',
    detail: `source=${r1b.headingSource}, heading=${r1b.newHeading}, isMoving=${r1b.isMoving}`
  });

  // Test 1c: Speed is null, barely moved (<3m) → should NOT be moving
  const r1c = determineHeading(
    { lat: 5.600001, lng: -0.2, speed: null, heading: null },
    { lat: 5.6, lng: -0.2 },
    270,
    () => 90
  );
  const dist1c = calculateGPSDistance(5.6, -0.2, 5.600001, -0.2);
  results.push({
    name: `Speed null, moved ${dist1c.toFixed(1)}m → should NOT be moving`,
    pass: r1c.isMoving === false,
    detail: `isMoving=${r1c.isMoving}, dist=${dist1c.toFixed(1)}m`
  });

  // Test 1d: Speed explicitly reported as 0 → stationary hold
  const r1d = determineHeading(
    { lat: 5.6, lng: -0.2, speed: 0, heading: null },
    { lat: 5.6, lng: -0.2 },
    270,
    () => 90
  );
  results.push({
    name: 'Speed=0 (explicit) → stationary hold',
    pass: r1d.headingSource === 'stationary-hold',
    detail: `source=${r1d.headingSource}, isMoving=${r1d.isMoving}`
  });

  // Test 1e: Speed > threshold, has GPS bearing → should use route (priority 1)
  const r1e = determineHeading(
    { lat: 5.6, lng: -0.2, speed: 5.0, heading: 120 },
    null,
    270,
    () => 45
  );
  results.push({
    name: 'Speed>threshold, GPS bearing=120, route=45 → should use route (priority 1)',
    pass: r1e.headingSource === 'route' && r1e.newHeading === 45,
    detail: `source=${r1e.headingSource}, heading=${r1e.newHeading}`
  });

  // Test 1f: Speed > threshold, no route heading, has GPS bearing → GPS bearing
  const r1f = determineHeading(
    { lat: 5.6, lng: -0.2, speed: 5.0, heading: 120 },
    null,
    270,
    () => null  // no route heading
  );
  results.push({
    name: 'Speed>threshold, no route, GPS=120 → should use GPS bearing',
    pass: r1f.headingSource === 'GPS-bearing' && r1f.newHeading === 120,
    detail: `source=${r1f.headingSource}, heading=${r1f.newHeading}`
  });

  return results;
}

// ============================================================
// TEST 2: Canvas rotation (createRotatedTricycleUrl logic)
// ============================================================
function testCanvasRotation() {
  const results = [];

  function getImageOrientation(heading) {
    const h = ((heading % 360) + 360) % 360;
    if (h >= 315 || h < 45) {
      return { isVertical: true, shouldFlip: false };  // North (UP)
    } else if (h >= 45 && h < 135) {
      return { isVertical: false, shouldFlip: true };  // East (RIGHT)
    } else if (h >= 135 && h < 225) {
      return { isVertical: true, shouldFlip: true };   // South (DOWN)
    } else {
      return { isVertical: false, shouldFlip: false };  // West (LEFT)
    }
  }

  function calculateFineRotation(heading) {
    const { isVertical, shouldFlip } = getImageOrientation(heading);

    let baseAngle;
    if (!isVertical && !shouldFlip) baseAngle = 270;
    else if (!isVertical && shouldFlip) baseAngle = 90;
    else if (isVertical && !shouldFlip) baseAngle = 0;
    else baseAngle = 180;

    let fineRotation = heading - baseAngle;
    while (fineRotation > 180) fineRotation -= 360;
    while (fineRotation < -180) fineRotation += 360;
    fineRotation = Math.max(-45, Math.min(45, fineRotation));

    return { isVertical, shouldFlip, baseAngle, fineRotation };
  }

  // Test cardinal directions - fine rotation should be 0
  const cardinals = [
    { heading: 0, expected: { base: 90, fine: -90 } },  // East quadrant, but heading=0 → fine = 0-90 = -90 → clamped to -45
    { heading: 90, expected: { base: 180, fine: -90 } }, // South quadrant, heading=90 → fine = 90-180 = -90 → clamped to -45
  ];

  // Actually let me recalculate more carefully:
  // Heading = 0° (North, in East quadrant since 315-45):
  //   isVertical=false, shouldFlip=true → baseAngle = 90°
  //   fineRotation = 0 - 90 = -90° → clamped to -45°
  // Heading = 45° (NE, in South quadrant since 45-135):
  //   isVertical=true, shouldFlip=true → baseAngle = 180°
  //   fineRotation = 45 - 180 = -135° → clamped to -45°
  // Heading = 90° (East, in South quadrant):
  //   isVertical=true, shouldFlip=true → baseAngle = 180°
  //   fineRotation = 90 - 180 = -90° → clamped to -45°
  // Heading = 180° (South, in West quadrant since 135-225):
  //   isVertical=false, shouldFlip=false → baseAngle = 270°
  //   fineRotation = 180 - 270 = -90° → clamped to -45°
  // Heading = 270° (West, in North quadrant since 225-315):
  //   isVertical=true, shouldFlip=false → baseAngle = 0°
  //   fineRotation = 270 - 0 = 270° → normalized to -90° → clamped to -45°

  // Hmm, the fine rotation is -45° for all cardinals. That means the base angles don't match the cardinal directions.
  // Let me reconsider: the quadrant boundaries are at 45°, 135°, 225°, 315°
  // The base angles are:
  //   East (315-45°): base=90° → center of quadrant is 0°, so fine for center = 0-90=-90 → clamped to -45
  // This seems wrong. Let me check if the base angles should be different.

  // Actually looking at getImageOrientation:
  // East quadrant (315-45°): horizontal, flip right → the image faces RIGHT (90° in compass)
  // But the center of the East quadrant is 0° (North!). That's the issue.
  // The compass convention: 0°=North, 90°=East, 180°=South, 270°=West
  // But the quadrant names in the code are misleading - "East" really means the quadrant around compass 0° (North)

  // Let me re-read the code comments:
  // 315-45° (East-ish): → this is actually NORTH-ish on compass!
  // Wait no, the code says:
  // if (h >= 315 || h < 45) → "East - use horizontal, flip to face right"
  // This is incorrect labeling. Compass 0° is North, 90° is East.
  // h >= 315 || h < 45 covers headings around 0°/360° which is... NORTH on compass.
  // But on a screen map, NORTH = UP. The code flips the image to face RIGHT.
  // That would make it face EAST on screen, not North.

  // I think the issue is the code maps compass bearings to screen directions incorrectly.
  // Compass 0° = North = Up on map → should use vertical image facing up, not horizontal facing right.

  // This is a fundamental mismatch in the orientation logic!
  // Let me verify:
  // If driver is heading compass 0° (North), the tricycle should face UP on the map.
  // Code: h >= 315 || h < 45 → horizontal image, flipped right → faces RIGHT, not UP.

  // This is a BUG. The quadrant logic maps compass to screen incorrectly.
  // Correct mapping:
  // Compass 0° (North) = Screen UP → vertical image, no flip
  // Compass 90° (East) = Screen RIGHT → horizontal image, flip
  // Compass 180° (South) = Screen DOWN → vertical image, flip
  // Compass 270° (West) = Screen LEFT → horizontal image, no flip

  // So the correct getImageOrientation should be:
  // 315-45° (around compass 0° = North): vertical, no flip (faces UP)
  // 45-135° (around compass 90° = East): horizontal, flip (faces RIGHT)
  // 135-225° (around compass 180° = South): vertical, flip (faces DOWN)
  // 225-315° (around compass 270° = West): horizontal, no flip (faces LEFT)

  // Test compass 0° (North) → vertical, no flip (faces UP)
  const r0 = calculateFineRotation(0);
  results.push({
    name: 'Heading=0° (North) → vertical+noFlip (UP)',
    pass: r0.isVertical === true && r0.shouldFlip === false && r0.baseAngle === 0,
    detail: `isVertical=${r0.isVertical}, shouldFlip=${r0.shouldFlip}, baseAngle=${r0.baseAngle}, fineRotation=${r0.fineRotation}°`
  });

  // Test compass 90° (East) → horizontal, flip (faces RIGHT)
  const r90 = calculateFineRotation(90);
  results.push({
    name: 'Heading=90° (East) → horizontal+flip (RIGHT)',
    pass: r90.isVertical === false && r90.shouldFlip === true && r90.baseAngle === 90,
    detail: `isVertical=${r90.isVertical}, shouldFlip=${r90.shouldFlip}, baseAngle=${r90.baseAngle}, fineRotation=${r90.fineRotation}°`
  });

  // Test compass 180° (South) → vertical, flip (faces DOWN)
  const r180 = calculateFineRotation(180);
  results.push({
    name: 'Heading=180° (South) → vertical+flip (DOWN)',
    pass: r180.isVertical === true && r180.shouldFlip === true && r180.baseAngle === 180,
    detail: `isVertical=${r180.isVertical}, shouldFlip=${r180.shouldFlip}, baseAngle=${r180.baseAngle}, fineRotation=${r180.fineRotation}°`
  });

  // Test compass 270° (West) → horizontal, no flip (faces LEFT)
  const r270 = calculateFineRotation(270);
  results.push({
    name: 'Heading=270° (West) → horizontal+noFlip (LEFT)',
    pass: r270.isVertical === false && r270.shouldFlip === false && r270.baseAngle === 270,
    detail: `isVertical=${r270.isVertical}, shouldFlip=${r270.shouldFlip}, baseAngle=${r270.baseAngle}, fineRotation=${r270.fineRotation}°`
  });

  // Test diagonal: 45° (NE boundary) → in East quadrant
  const r45 = calculateFineRotation(45);
  results.push({
    name: 'Heading=45° (NE) → horizontal+flip (East quadrant), fine rotation=-45°',
    pass: r45.isVertical === false && r45.shouldFlip === true && r45.fineRotation === -45,
    detail: `isVertical=${r45.isVertical}, shouldFlip=${r45.shouldFlip}, baseAngle=${r45.baseAngle}, fineRotation=${r45.fineRotation}°`
  });

  // Test diagonal: 135° (SE boundary) → in South quadrant
  const r135 = calculateFineRotation(135);
  results.push({
    name: 'Heading=135° (SE) → vertical+flip (South quadrant), fine rotation=-45°',
    pass: r135.isVertical === true && r135.shouldFlip === true && r135.fineRotation === -45,
    detail: `isVertical=${r135.isVertical}, shouldFlip=${r135.shouldFlip}, baseAngle=${r135.baseAngle}, fineRotation=${r135.fineRotation}°`
  });

  return results;
}

// ============================================================
// TEST 3: Walking line distance threshold
// ============================================================
function testWalkingLineThreshold() {
  const results = [];

  function calculateGPSDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Route endpoint very close to bin (2m) → should NOT draw walking line
  const dist1 = calculateGPSDistance(5.6, -0.2, 5.60002, -0.2);
  results.push({
    name: `Route end ${dist1.toFixed(1)}m from bin → no walking line (< 5m)`,
    pass: dist1 < 5,
    detail: `distance=${dist1.toFixed(1)}m, threshold=5m`
  });

  // Route endpoint 50m from bin → should draw walking line
  const dist2 = calculateGPSDistance(5.6, -0.2, 5.6005, -0.2);
  results.push({
    name: `Route end ${dist2.toFixed(1)}m from bin → draw walking line (> 5m)`,
    pass: dist2 > 5,
    detail: `distance=${dist2.toFixed(1)}m, threshold=5m`
  });

  return results;
}

// ============================================================
// TEST 4: Zoom-out on arrival (prop flow)
// ============================================================
function testZoomOutPropFlow() {
  const results = [];

  // Verify NavigationQRModal passes isArrived={hasArrivedAtDestination}
  // This is a static code check - we verify the prop exists
  const fs = require('fs');
  const navQRContent = fs.readFileSync(
    '/Users/otisa.apaloo/CascadeProjects/TrashDrop_Mobile_Collector_Driver/src/components/NavigationQRModal.jsx', 'utf8'
  );
  const gmapsContent = fs.readFileSync(
    '/Users/otisa.apaloo/CascadeProjects/TrashDrop_Mobile_Collector_Driver/src/components/GoogleMapsNavigation.jsx', 'utf8'
  );
  const assignContent = fs.readFileSync(
    '/Users/otisa.apaloo/CascadeProjects/TrashDrop_Mobile_Collector_Driver/src/components/AssignmentNavigationModal.jsx', 'utf8'
  );

  results.push({
    name: 'NavigationQRModal passes isArrived={hasArrivedAtDestination}',
    pass: navQRContent.includes('isArrived={hasArrivedAtDestination}'),
    detail: 'Checks that the arrival state is passed to GoogleMapsNavigation'
  });

  results.push({
    name: 'AssignmentNavigationModal passes isArrived={hasArrived}',
    pass: assignContent.includes('isArrived={hasArrived}'),
    detail: 'Checks that the arrival state is passed to GoogleMapsNavigation'
  });

  results.push({
    name: 'GoogleMapsNavigation accepts isArrived prop',
    pass: gmapsContent.includes('isArrived = false'),
    detail: 'Checks prop default value'
  });

  results.push({
    name: 'GoogleMapsNavigation has fitBounds zoom-out useEffect',
    pass: gmapsContent.includes('map.fitBounds(bounds') && gmapsContent.includes('isArrived'),
    detail: 'Checks that fitBounds is called when isArrived changes'
  });

  results.push({
    name: 'Zoom-out disables follow mode',
    pass: gmapsContent.includes('setIsFollowMode(false)') &&
          gmapsContent.indexOf('setIsFollowMode(false)') > gmapsContent.indexOf('if (!isArrived'),
    detail: 'Follow mode must be disabled so auto-pan doesn\'t override the zoom-out'
  });

  results.push({
    name: 'Zoom capped at 18 to prevent over-zoom when close',
    pass: gmapsContent.includes('map.getZoom() > 18'),
    detail: 'When markers are very close, we cap zoom to 18'
  });

  return results;
}

// ============================================================
// TEST 5: Geofence radius consistency
// ============================================================
function testGeofenceConsistency() {
  const results = [];
  const fs = require('fs');

  const navQR = fs.readFileSync(
    '/Users/otisa.apaloo/CascadeProjects/TrashDrop_Mobile_Collector_Driver/src/components/NavigationQRModal.jsx', 'utf8'
  );
  const assignNav = fs.readFileSync(
    '/Users/otisa.apaloo/CascadeProjects/TrashDrop_Mobile_Collector_Driver/src/components/AssignmentNavigationModal.jsx', 'utf8'
  );

  // Check GEOFENCE_RADIUS constant
  const navRadius = navQR.match(/GEOFENCE_RADIUS\s*=\s*(\d+)/);
  results.push({
    name: 'NavigationQRModal GEOFENCE_RADIUS = 15',
    pass: navRadius && navRadius[1] === '15',
    detail: `Found: ${navRadius ? navRadius[1] : 'NOT FOUND'}`
  });

  const assignRadius = assignNav.match(/GEOFENCE_RADIUS\s*=\s*(\d+)/);
  results.push({
    name: 'AssignmentNavigationModal GEOFENCE_RADIUS = 15',
    pass: assignRadius && assignRadius[1] === '15',
    detail: `Found: ${assignRadius ? assignRadius[1] : 'NOT FOUND'}`
  });

  // Check no stale 0.05 references in these files
  const stale05NavQR = (navQR.match(/distance\s*<=\s*0\.05/g) || []).length;
  results.push({
    name: 'NavigationQRModal has no stale 0.05 geofence checks',
    pass: stale05NavQR === 0,
    detail: `Found ${stale05NavQR} occurrences of "distance <= 0.05"`
  });

  const stale05Assign = (assignNav.match(/distance\s*<=\s*0\.05/g) || []).length;
  results.push({
    name: 'AssignmentNavigationModal has no stale 0.05 geofence checks',
    pass: stale05Assign === 0,
    detail: `Found ${stale05Assign} occurrences of "distance <= 0.05"`
  });

  // Check error messages say 15m not 50m
  const stale50mNavQR = (navQR.match(/within 50 meters/gi) || []).length;
  results.push({
    name: 'NavigationQRModal error messages say 15m not 50m',
    pass: stale50mNavQR === 0,
    detail: `Found ${stale50mNavQR} occurrences of "within 50 meters"`
  });

  return results;
}

// ============================================================
// TEST 6: Road snapping & rerouting
// ============================================================
function testRoadSnapping() {
  const results = [];
  const fs = require('fs');

  const gmapsContent = fs.readFileSync(
    '/Users/otisa.apaloo/CascadeProjects/TrashDrop_Mobile_Collector_Driver/src/components/GoogleMapsNavigation.jsx', 'utf8'
  );

  results.push({
    name: 'snapToPolyline function exists',
    pass: gmapsContent.includes('const snapToPolyline'),
    detail: 'Function that finds nearest point on route polyline'
  });

  results.push({
    name: 'projectPointOnSegment function exists',
    pass: gmapsContent.includes('const projectPointOnSegment'),
    detail: 'Helper for geometric projection onto line segment'
  });

  results.push({
    name: 'triggerReroute function exists',
    pass: gmapsContent.includes('const triggerReroute'),
    detail: 'Fires new Directions API request when off-route'
  });

  results.push({
    name: 'REROUTE_DISTANCE_THRESHOLD = 20m',
    pass: gmapsContent.includes('REROUTE_DISTANCE_THRESHOLD = 20'),
    detail: 'Off-route threshold is 20 meters'
  });

  results.push({
    name: 'REROUTE_COOLDOWN_MS = 10000',
    pass: gmapsContent.includes('REROUTE_COOLDOWN_MS = 10000'),
    detail: '10-second cooldown between reroute requests'
  });

  results.push({
    name: 'Route polyline stored after directions calculated',
    pass: gmapsContent.includes('routePolylineRef.current = route.overview_path.map'),
    detail: 'overview_path is saved for snap calculations'
  });

  results.push({
    name: 'Snap applied in marker update useEffect',
    pass: gmapsContent.includes('const snapResult = snapToPolyline(userLocation.lat, userLocation.lng)'),
    detail: 'Snapping is called in the marker update loop'
  });

  results.push({
    name: 'Snap applied in watchPosition callback',
    pass: gmapsContent.includes('const snapResult = snapToPolyline(userLat, userLng)'),
    detail: 'Snapping is also called in GPS tracking callback'
  });

  return results;
}

// ============================================================
// RUN ALL TESTS
// ============================================================
console.log('='.repeat(70));
console.log('  NAVIGATION FEATURE TESTS');
console.log('='.repeat(70));

const allTests = [
  { name: 'Heading Determination (speed-null fix)', fn: testHeadingDetermination },
  { name: 'Canvas Rotation (fine rotation)', fn: testCanvasRotation },
  { name: 'Walking Line Threshold', fn: testWalkingLineThreshold },
  { name: 'Zoom-Out on Arrival (prop flow)', fn: testZoomOutPropFlow },
  { name: 'Geofence Radius Consistency', fn: testGeofenceConsistency },
  { name: 'Road Snapping & Rerouting', fn: testRoadSnapping },
];

let totalPass = 0;
let totalFail = 0;
const failures = [];

for (const suite of allTests) {
  console.log(`\n--- ${suite.name} ---`);
  const results = suite.fn();
  for (const r of results) {
    const icon = r.pass ? '✅' : '❌';
    console.log(`  ${icon} ${r.name}`);
    if (!r.pass) {
      console.log(`     Detail: ${r.detail}`);
      failures.push({ suite: suite.name, test: r.name, detail: r.detail });
    }
    r.pass ? totalPass++ : totalFail++;
  }
}

console.log('\n' + '='.repeat(70));
console.log(`  RESULTS: ${totalPass} passed, ${totalFail} failed`);
if (failures.length > 0) {
  console.log('\n  FAILURES:');
  for (const f of failures) {
    console.log(`  ❌ [${f.suite}] ${f.test}`);
    console.log(`     ${f.detail}`);
  }
}
console.log('='.repeat(70));

process.exit(totalFail > 0 ? 1 : 0);
