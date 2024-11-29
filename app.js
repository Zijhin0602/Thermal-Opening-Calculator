// 確保 DxfParser 是全局可用的 
const DxfParser = window.DxfParser || {}; 

if (typeof DxfParser === 'undefined') { 
    console.error('DxfParser is not defined. Make sure the library is loaded correctly.'); 
}

if (typeof ThreeDxf === 'undefined') { 
    console.error('ThreeDxf is not defined. Make sure the library is loaded correctly.'); 
}

let totalYellowArea = 0; 
let totalGreenArea = 0; 
let totalBlueArea = 0; 
let totalBlueVisibleArea = 0; 

// 全域變數，用於存儲圓形數據
let yellowCircles = [];
let blueCircles = [];

// 計算兩個圓的交集面積
function calculateIntersectionArea(circle1, circle2) {
    const r1 = circle1.radius;
    const r2 = circle2.radius;
    const p1 = new THREE.Vector2(circle1.center.x, circle1.center.y);
    const p2 = new THREE.Vector2(circle2.center.x, circle2.center.y);
    const d = p1.distanceTo(p2);

    if (d >= r1 + r2 || d <= Math.abs(r1 - r2)) {
        return 0; // 不相交或完全包含
    }

    // 計算交集面積
    const a1 = r1 * r1 * Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1));
    const a2 = r2 * r2 * Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2));
    const a3 = 0.5 * Math.sqrt((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2));
    return a1 + a2 - a3;
}

function calculateTotalAreaFromDXF(dxf) {
    totalYellowArea = 0;
    totalGreenArea = 0;
    totalBlueArea = 0;
    totalBlueVisibleArea = 0;

    yellowCircles = [];
    blueCircles = [];

    // 首先收集所有圓形
    dxf.entities.forEach(entity => {
        if (entity.type === 'CIRCLE') {
            const area = Math.PI * Math.pow(entity.radius, 2);
            if (entity.layer === '圖層 1') {
                totalYellowArea += area;
                yellowCircles.push(entity);
            } else {
                totalBlueArea += area;
                blueCircles.push(entity);
            }
        }
    });

    // 將圓形轉換為多邊形點集
    const yellowPolygons = yellowCircles.map(circle => circleToPolygon(circle, 64));
    const bluePolygons = blueCircles.map(circle => circleToPolygon(circle, 64));

    // 計算交集
    let totalIntersection = 0;
    yellowPolygons.forEach(yellowPoly => {
        bluePolygons.forEach(bluePoly => {
            const intersection = calculatePolygonIntersection(yellowPoly, bluePoly);
            if (intersection) {
                totalIntersection += calculatePolygonArea(intersection);
            }
        });
    });

    totalGreenArea = totalIntersection;
    totalBlueVisibleArea = totalBlueArea - totalGreenArea;

    console.log('計算完成:', {
        totalYellowArea,
        totalGreenArea,
        totalBlueVisibleArea,
        ratio: totalGreenArea / (totalYellowArea + totalGreenArea)
    });
}

// 將圓形轉換為多邊形點集
function circleToPolygon(circle, segments = 128) {
    const points = [];
    const angleStep = (2 * Math.PI) / segments;
    
    for (let i = 0; i < segments; i++) {
        const angle = i * angleStep;
        const x = circle.center.x + circle.radius * Math.cos(angle);
        const y = circle.center.y + circle.radius * Math.sin(angle);
        points.push({ X: x * 1000, Y: y * 1000 }); // 放大坐標以提高精度
    }
    
    return points;
}

// 計算多邊形交集
function calculatePolygonIntersection(poly1, poly2) {
    const clipper = new ClipperLib.Clipper();
    const solution = new ClipperLib.Paths();

    const subj = new ClipperLib.Paths();
    const clip = new ClipperLib.Paths();

    subj.push(poly1);
    clip.push(poly2);

    clipper.AddPaths(subj, ClipperLib.PolyType.ptSubject, true);
    clipper.AddPaths(clip, ClipperLib.PolyType.ptClip, true);

    if (clipper.Execute(ClipperLib.ClipType.ctIntersection, solution)) {
        return solution.length > 0 ? solution[0] : null;
    }
    return null;
}

// 計算多邊形面積
function calculatePolygonArea(polygon) {
    if (!polygon || polygon.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < polygon.length; i++) {
        const j = (i + 1) % polygon.length;
        area += (polygon[i].X * polygon[j].Y - polygon[j].X * polygon[i].Y);
    }
    
    return Math.abs(area) / (2 * 1000000); // 縮小回原始比例
}

function processFile(file) { 
    const reader = new FileReader(); 
    reader.onload = function(e) { 
        const parser = new DxfParser(); 
        try { 
            const dxf = parser.parseSync(e.target.result); 
            calculateTotalAreaFromDXF(dxf); 
            displayResults();
            renderDxfPreview(dxf); 
        } catch (error) { 
            console.error('Error parsing or rendering DXF:', error); 
            alert('解析或渲染 DXF 時發生錯誤: ' + error.message); 
        } 
    }; 
    reader.onerror = function(e) { 
        console.error('Error reading file:', e); 
        alert('讀取文件時發生錯誤'); 
    }; 
    reader.readAsText(file); 
}

function renderDxfPreview(dxf) {
    console.log('開始渲染 DXF 預覽...');
    const el = document.getElementById('previewCanvas');
    el.innerHTML = '';

    // 計算邊界框
    let bounds = {
        min: { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY },
        max: { x: Number.NEGATIVE_INFINITY, y: Number.NEGATIVE_INFINITY }
    };

    dxf.entities.forEach(entity => {
        if (entity.type === 'CIRCLE') {
            bounds.min.x = Math.min(bounds.min.x, entity.center.x - entity.radius);
            bounds.min.y = Math.min(bounds.min.y, entity.center.y - entity.radius);
            bounds.max.x = Math.max(bounds.max.x, entity.center.x + entity.radius);
            bounds.max.y = Math.max(bounds.max.y, entity.center.y + entity.radius);
        }
    });

    // 計算視圖大小和縮放
    const width = bounds.max.x - bounds.min.x;
    const height = bounds.max.y - bounds.min.y;
    const center = {
        x: (bounds.max.x + bounds.min.x) / 2,
        y: (bounds.max.y + bounds.min.y) / 2
    };
    
    const scale = Math.min(el.clientWidth / width, el.clientHeight / height) * 0.9;

    // 設置場景和相機
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    
    const camera = new THREE.OrthographicCamera(
        -el.clientWidth / 2 / scale, 
        el.clientWidth / 2 / scale,
        el.clientHeight / 2 / scale, 
        -el.clientHeight / 2 / scale, 
        1, 1000
    );
    camera.position.z = 100;

    // 設置渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    // 修改材質定義
    const yellowMaterial = new THREE.MeshBasicMaterial({
        color: 0xFFFF00,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
    });

    const blueMaterial = new THREE.MeshBasicMaterial({
        color: 0x0000FF,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
    });

    const greenMaterial = new THREE.MeshBasicMaterial({
        color: 0x00FF00,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
    });

    const group = new THREE.Group();
    const yellowCircles = [];
    const blueCircles = [];

    // 首先渲染所有圓形
    dxf.entities.forEach(entity => {
        if (entity.type === 'CIRCLE') {
            const geometry = new THREE.CircleGeometry(entity.radius, 128);
            const material = entity.layer === '圖層 1' ? yellowMaterial : blueMaterial;
            const circle = new THREE.Mesh(geometry, material);
            circle.position.set(entity.center.x, entity.center.y, 0);
            
            if (entity.layer === '圖層 1') {
                yellowCircles.push({
                    mesh: circle,
                    radius: entity.radius,
                    center: entity.center
                });
            } else {
                blueCircles.push({
                    mesh: circle,
                    radius: entity.radius,
                    center: entity.center
                });
            }
            
            group.add(circle);
        }
    });

    // 處理交集
    yellowCircles.forEach(yellow => {
        blueCircles.forEach(blue => {
            const dx = yellow.center.x - blue.center.x;
            const dy = yellow.center.y - blue.center.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < yellow.radius + blue.radius) {
                const intersectionGeometry = createIntersectionGeometry({
                    radius: yellow.radius,
                    center: yellow.center
                }, {
                    radius: blue.radius,
                    center: blue.center
                });
                
                if (intersectionGeometry) {
                    const intersectionMesh = new THREE.Mesh(intersectionGeometry, greenMaterial);
                    intersectionMesh.position.z = 0.1; // 略微提升z軸位置
                    group.add(intersectionMesh);
                }
            }
        });
    });

    scene.add(group);
    group.position.set(-center.x, -center.y, 0);

    // 渲染循環
    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
    animate();

    console.log('DXF 預覽渲染完成');
}

function displayResults() {
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = `
        <p>黃色圓形總面積: ${totalYellowArea.toFixed(2)} 平方單位</p>
        <p>綠色區域總面積: ${totalGreenArea.toFixed(2)} 平方單位</p>
        <p>藍色可見面積: ${totalBlueVisibleArea.toFixed(2)} 平方單位</p>
        <p>開孔率: ${(totalGreenArea / totalYellowArea * 100).toFixed(2)}%</p>
    `;
}

window.onload = function() { 
    const fileInput = document.getElementById('dxfFile'); 
    fileInput.addEventListener('change', function(event) { 
        const file = event.target.files[0]; 
        if (file) { 
            processFile(file); 
        } 
    }); 
};

function createIntersectionGeometry(circle1, circle2) {
    const poly1 = circleToPolygon(circle1);
    const poly2 = circleToPolygon(circle2);
    
    const intersection = calculatePolygonIntersection(poly1, poly2);
    if (!intersection) return null;

    // 創建 THREE.js 形狀
    const shape = new THREE.Shape();
    
    // 將交集多邊形轉換回實際坐標
    intersection.forEach((point, index) => {
        const x = point.X / 1000;
        const y = point.Y / 1000;
        if (index === 0) {
            shape.moveTo(x, y);
        } else {
            shape.lineTo(x, y);
        }
    });
    
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
}
