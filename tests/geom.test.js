// Test hors Illustrator du bloc géométrie / Out-of-Illustrator geometry test
var fs = require('fs');
var src = fs.readFileSync(__dirname + '/../RepartirSurTrace.jsx', 'utf8');
var m = src.match(/\/\/ <GEOM>[\s\S]*?\/\/ <\/GEOM>/);
var SAMPLES_PER_SEGMENT = 64;
eval(m[0]);
var ok = 0, ko = 0;
function check(name, cond, info) { if (cond) { ok++; } else { ko++; console.log('FAIL', name, info || ''); } }
function near(a, b, eps) { return Math.abs(a - b) <= eps; }
function P(x, y) { return { anchor: [x, y], leftDirection: [x, y], rightDirection: [x, y] }; }

// 1. Ligne droite 0→100 / straight line
var line = buildPathModel([P(0, 0), P(100, 0)], false);
check('line length', near(line.length, 100, 1e-6), line.length);
var mid = pointAtDistance(line, 50);
check('line mid', near(mid.x, 50, 1e-6) && near(mid.y, 0, 1e-6) && near(mid.angle, 0, 1e-6), JSON.stringify(mid));
var d = computeDistances(line, { mode: 'equal', count: 5, startPct: 0, endPct: 0 });
check('equal open 5', d.length === 5 && near(d[0], 0, 1e-9) && near(d[4], 100, 1e-9) && near(d[1], 25, 1e-9), d);
d = computeDistances(line, { mode: 'equal', count: 1, startPct: 0, endPct: 0 });
check('equal open 1 = middle', d.length === 1 && near(d[0], 50, 1e-9), d);
d = computeDistances(line, { mode: 'interval', count: 0, interval: 30, startPct: 10, endPct: 0 });
check('interval 30 from 10', d.join() === '10,40,70,100', d);
d = computeDistances(line, { mode: 'interval', count: 2, interval: 30, startPct: 0, endPct: 0 });
check('interval capped', d.length === 2, d);

// 2. Cercle r=50 en 4 arcs (kappa) / circle from 4 cubic arcs
var r = 50, k = 0.5522847498 * r;
function C(x, y, lx, ly, rx, ry) { return { anchor: [x, y], leftDirection: [lx, ly], rightDirection: [rx, ry] }; }
// sens antihoraire / counter-clockwise : (r,0) → (0,r) → (-r,0) → (0,-r)
var circle = buildPathModel([
    C(r, 0, r, -k, r, k),
    C(0, r, k, r, -k, r),
    C(-r, 0, -r, k, -r, -k),
    C(0, -r, -k, -r, k, -r)
], true);
check('circle length', near(circle.length, 2 * Math.PI * r, 0.05), circle.length);
var q = pointAtDistance(circle, circle.length / 4);
check('circle quarter point', near(q.x, 0, 0.05) && near(q.y, r, 0.05), JSON.stringify(q));
check('circle quarter tangent 180°', near(Math.abs(q.angle), 180, 0.5), q.angle);
var p0 = pointAtDistance(circle, 0);
check('circle start tangent 90°', near(p0.angle, 90, 0.5), p0.angle);
d = computeDistances(circle, { mode: 'equal', count: 8, startPct: 0, endPct: 0 });
check('closed loop no duplicate end', d.length === 8 && near(d[7], circle.length * 7 / 8, 1e-6), d);
d = computeDistances(circle, { mode: 'interval', count: 0, interval: circle.length / 4, startPct: 0, endPct: 0 });
check('closed interval no duplicate end', d.length === 4, d.length);

// 3. Poignées confondues (coin) / coincident handles
var corner = buildPathModel([P(0, 0), P(0, 100), P(100, 100)], false);
var c1 = pointAtDistance(corner, 0);
check('degenerate handle tangent', near(c1.angle, 90, 1e-3), c1.angle);
var c2 = pointAtDistance(corner, 150);
check('second segment', near(c2.x, 50, 1e-6) && near(c2.y, 100, 1e-6) && near(c2.angle, 0, 1e-3), JSON.stringify(c2));

// 4. Tri naturel / natural sort
var names = ['a10', 'a2', 'A1', 'b'];
names.sort(naturalCompare);
check('natural sort', names.join() === 'A1,a2,a10,b', names);

// 5. Début + fin hors limites / invalid range
d = computeDistances(line, { mode: 'equal', count: 3, startPct: 60, endPct: 60 });
check('empty range', d.length === 0, d);

console.log(ok + ' OK, ' + ko + ' échec(s)');
process.exit(ko ? 1 : 0);
