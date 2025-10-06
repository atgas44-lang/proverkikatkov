// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDoZwu19QasbZfbt3fC0RuQ5hNlt8QqgVY",
    authDomain: "test-toha.firebaseapp.com",
    databaseURL: "https://test-toha-default-rtdb.europe-west1.firebasedatabase.app", // ⚠️ Проверьте URL после создания БД
    projectId: "test-toha",
    storageBucket: "test-toha.firebasestorage.app",
    messagingSenderId: "213587069553",
    appId: "1:213587069553:web:9631dd0aaf920dbaa829d0",
    measurementId: "G-6Q9D7HJXT1"
};

// Initialize Firebase
let database;
let useFirebase = false;
let isSyncing = false;

function initializeFirebase() {
    try {
        firebase.initializeApp(firebaseConfig);
        database = firebase.database();
        console.log('✅ Firebase initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Firebase initialization error:', error);
        console.warn('⚠️ Falling back to localStorage');
        return false;
    }
}

// Данные по объектам
const objects = [
    {id: 1, name: "ул. Ангарская, д. 39", district: "САО", size: "30х60м", sizeCode: "1800"},
    {id: 2, name: "ул. Коненкова, д. 9", district: "СВАО", size: "20х40м", sizeCode: "800"},
    {id: 3, name: "Парк у Святого озера", district: "ВАО", size: "30х60м", sizeCode: "1800"},
    {id: 4, name: "ул. Перерва д. 41", district: "ЮВАО", size: "30х60м+20х40м", sizeCode: "1800"},
    {id: 5, name: "ул. Лебедянская, д. 4", district: "ЮАО", size: "20х40м", sizeCode: "800"},
    {id: 6, name: "ул. Волотниковская, д. 33, корп. 2", district: "ЮЗАО", size: "30х60м", sizeCode: "1800"},
    {id: 7, name: "ул. 50 лет Октября, д. 6", district: "ЗАО", size: "30х60м", sizeCode: "1800"},
    {id: 8, name: "ул. Генерала Глаголева, д. 30, корп. 5", district: "СЗАО", size: "20х40м", sizeCode: "800"},
    {id: 9, name: "г. Зеленоград, корп. 165 В", district: "ЗелАО", size: "20х40м", sizeCode: "800"},
    {id: 10, name: "Щербинка, ул. Маршала Савицкого, д. 5", district: "ТиНАО", size: "20х40м", sizeCode: "800"},
    {id: 11, name: "Коммунарка, территория за Конторским прудом", district: "ТиНАО", size: "20х40м", sizeCode: "800"}
];

let currentObject = null;
let currentTab = 'cooling';
let allObjectsData = {};

// Инициализация
function initialize() {
    // Попытка инициализации Firebase
    useFirebase = initializeFirebase();
    
    // Инициализация данных для всех объектов
    objects.forEach(obj => {
        if (!allObjectsData[obj.id]) {
            allObjectsData[obj.id] = {
                cooling: {statuses: {}, data: {}},
                lights: {statuses: {}, data: {}},
                abk: {statuses: {}, data: {}},
                boards: {statuses: {}, data: {}},
                furniture: {statuses: {}, data: {}},
                systems: {statuses: {}, data: {}},
                ice: {statuses: {}, data: {}}
            };
            
            // Инициализация статусов для холодильной установки (7 критериев соответствия)
            for (let i = 1; i <= 7; i++) {
                allObjectsData[obj.id].cooling.statuses[i] = 'pending';
            }
            
            // Инициализация статусов для освещения (6 критериев)
            for (let i = 1; i <= 6; i++) {
                allObjectsData[obj.id].lights.statuses[i] = 'pending';
            }
            
            // Инициализация статусов для АБК (16 критериев)
            for (let i = 1; i <= 16; i++) {
                allObjectsData[obj.id].abk.statuses[i] = 'pending';
            }
            
            // Инициализация статусов для хоккейного борта (14 критериев)
            for (let i = 1; i <= 14; i++) {
                allObjectsData[obj.id].boards.statuses[i] = 'pending';
            }
            
            // Инициализация статусов для инженерных систем (10 критериев)
            for (let i = 1; i <= 10; i++) {
                allObjectsData[obj.id].systems.statuses[i] = 'pending';
            }
            
            // Инициализация статусов для ледозаливочной машины (7 критериев)
            for (let i = 1; i <= 7; i++) {
                allObjectsData[obj.id].ice.statuses[i] = 'pending';
            }
        }
    });
    
    // Загрузка сохраненных данных
    if (useFirebase) {
        // Не настраиваем автоматические слушатели для экономии запросов
        // setupFirebaseListeners();
        loadAllDataFromFirebase();
    } else {
        loadAllDataFromLocalStorage();
    }
    
    // Обновление сводной таблицы
    updateSummaryTable();
    
    // Показать индикатор статуса подключения
    updateConnectionStatus();
}

// Настройка слушателей Firebase для real-time обновлений
function setupFirebaseListeners() {
    const dataRef = database.ref('equipmentCheckData');
    
    dataRef.on('value', (snapshot) => {
        if (isSyncing) return; // Пропускаем обновление, если мы сами его вызвали
        
        const data = snapshot.val();
        if (data) {
            console.log('📥 Получены обновления из Firebase');
            
            // Обновляем локальные данные
            Object.keys(data).forEach(objId => {
                if (allObjectsData[objId]) {
                    allObjectsData[objId] = mergeDeep(allObjectsData[objId], data[objId]);
                }
            });
            
            // Обновляем UI
            updateSummaryTable();
            
            // Если открыт детальный вид, обновляем его
            if (currentObject) {
                loadObjectDataFromStorage();
            }
            
            // Показать уведомление об обновлении
            showNotification('Данные обновлены другим пользователем');
        }
    });
    
    // Отслеживание подключения
    const connectedRef = database.ref('.info/connected');
    connectedRef.on('value', (snapshot) => {
        updateConnectionStatus(snapshot.val());
    });
}

// Обновление индикатора подключения
function updateConnectionStatus(connected = null) {
    let statusHtml = '';
    
    console.log('🔗 Connection status changed:', connected);
    if (useFirebase) {
        statusHtml = '<div class="connection-status manual">� Обновление по запросу <button class="refresh-btn" onclick="refreshDataFromServer()">� Обновить данные</button></div>';
    } else {
        statusHtml = '<div class="connection-status offline">💾 Локальный режим (только на этом устройстве)</div>';
    }
    
    // Добавляем или обновляем индикатор статуса
    let statusElement = document.querySelector('.connection-status-container');
    if (!statusElement) {
        statusElement = document.createElement('div');
        statusElement.className = 'connection-status-container';
        document.querySelector('.header').appendChild(statusElement);
    }
    statusElement.innerHTML = statusHtml;
}

// Показать уведомление
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Глубокое слияние объектов
function mergeDeep(target, source) {
    const output = Object.assign({}, target);
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = mergeDeep(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
}

function isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
}

// Переключение видов
function switchView(view) {
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('#summaryView, #detailView').forEach(v => v.classList.remove('active'));
    
    if (view === 'summary') {
        document.querySelectorAll('.view-btn')[0].classList.add('active');
        document.getElementById('summaryView').classList.add('active');
        updateSummaryTable();
    } else {
        document.querySelectorAll('.view-btn')[1].classList.add('active');
        document.getElementById('detailView').classList.add('active');
    }
}

// Обновление сводной таблицы
function updateSummaryTable() {
    const tbody = document.getElementById('summaryTableBody');
    tbody.innerHTML = '';
    
    let globalPass = 0;
    let globalFail = 0;
    let globalPending = 0;
    
    objects.forEach(obj => {
        const row = document.createElement('tr');
        const data = allObjectsData[obj.id];
        
        // Подсчет статусов для каждого раздела
        const sections = ['cooling', 'lights', 'abk', 'boards', 'furniture', 'systems', 'ice'];
        const sectionStatuses = {};
        let totalPass = 0;
        let totalFail = 0;
        let totalPending = 0;
        
        sections.forEach(section => {
            let pass = 0, fail = 0, pending = 0;
            
            if (section === 'cooling') {
                for (let i = 1; i <= 7; i++) {
                    const status = data.cooling.statuses[i];
                    if (status === 'pass') pass++;
                    else if (status === 'fail') fail++;
                    else pending++;
                }
            } else if (section === 'lights') {
                for (let i = 1; i <= 6; i++) {
                    const status = data.lights.statuses[i];
                    if (status === 'pass') pass++;
                    else if (status === 'fail') fail++;
                    else pending++;
                }
            } else if (section === 'abk') {
                for (let i = 1; i <= 16; i++) {
                    const status = data.abk.statuses[i];
                    if (status === 'pass') pass++;
                    else if (status === 'fail') fail++;
                    else pending++;
                }
            } else if (section === 'boards') {
                for (let i = 1; i <= 14; i++) {
                    const status = data.boards.statuses[i];
                    if (status === 'pass') pass++;
                    else if (status === 'fail') fail++;
                    else pending++;
                }
            } else if (section === 'systems') {
                for (let i = 1; i <= 10; i++) {
                    const status = data.systems.statuses[i];
                    if (status === 'pass') pass++;
                    else if (status === 'fail') fail++;
                    else pending++;
                }
            } else if (section === 'ice') {
                for (let i = 1; i <= 7; i++) {
                    const status = data.ice.statuses[i];
                    if (status === 'pass') pass++;
                    else if (status === 'fail') fail++;
                    else pending++;
                }
            }
            
            sectionStatuses[section] = {pass, fail, pending};
            totalPass += pass;
            totalFail += fail;
            totalPending += pending;
            globalPass += pass;
            globalFail += fail;
            globalPending += pending;
        });
        
        // Расчет процента соответствия
        const compliance = totalPass + totalFail > 0 
            ? Math.round((totalPass / (totalPass + totalFail)) * 100) 
            : 0;
        
        const complianceClass = compliance >= 80 ? 'compliance-high' : 
                               compliance >= 50 ? 'compliance-medium' : 
                               'compliance-low';
        
        row.innerHTML = `
            <td>${obj.id}</td>
            <td class="object-name">${obj.name}</td>
            <td>${obj.district}</td>
            <td>${obj.size}</td>
            <td class="check-status">${getStatusIcon(sectionStatuses.cooling)}</td>
            <td class="check-status">${getStatusIcon(sectionStatuses.lights)}</td>
            <td class="check-status">${getStatusIcon(sectionStatuses.abk)}</td>
            <td class="check-status">${getStatusIcon(sectionStatuses.boards)}</td>
            <td class="check-status">${getStatusIcon(sectionStatuses.furniture)}</td>
            <td class="check-status">${getStatusIcon(sectionStatuses.systems)}</td>
            <td class="check-status">${getStatusIcon(sectionStatuses.ice)}</td>
            <td><span class="compliance-badge ${complianceClass}">${compliance}%</span></td>
            <td><button class="edit-btn" onclick="openDetailView(${obj.id})">Проверить</button></td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Обновление общей статистики
    document.getElementById('globalPass').textContent = globalPass;
    document.getElementById('globalFail').textContent = globalFail;
    document.getElementById('globalPending').textContent = globalPending;
    document.getElementById('totalChecks').textContent = globalPass + globalFail + globalPending;
}

// Получение иконки статуса для раздела
function getStatusIcon(status) {
    if (status.fail > 0) {
        return `<span class="check-fail">✗ (${status.fail})</span>`;
    } else if (status.pending > 0) {
        return `<span class="check-pending">⏳ (${status.pending})</span>`;
    } else if (status.pass > 0) {
        return `<span class="check-pass">✓ (${status.pass})</span>`;
    }
    return '<span class="check-pending">—</span>';
}

// Открытие детального вида
function openDetailView(objectId) {
    switchView('detail');
    document.getElementById('objectSelect').value = objectId;
    loadObjectData();
}

// Загрузка данных объекта
function loadObjectData() {
    const select = document.getElementById('objectSelect');
    
    if (select.value) {
        const obj = objects.find(o => o.id == select.value);
        currentObject = obj;
        
        document.getElementById('mainContent').style.display = 'block';
        
        // Обновление требований
        updateRequirements();
        
        // Загрузка сохраненных данных
        loadObjectDataFromStorage();
    } else {
        document.getElementById('mainContent').style.display = 'none';
        currentObject = null;
    }
}

// Обновление требований
function updateRequirements() {
    if (!currentObject) return;
    
    const isLarge = currentObject.sizeCode == '1800';
    
    document.getElementById('powerRequirement').textContent = 
        `Требование: минимум ${isLarge ? '285' : '185'} кВт`;
    document.getElementById('consumptionRequirement').textContent = 
        `Требование: максимум ${isLarge ? '220' : '155'} кВт`;
    document.getElementById('lightsRequirement').textContent = 
        `Стандарт: 4 опоры`;
    document.getElementById('iceAreaRequirement').textContent = 
        `Требование: минимум ${isLarge ? '1800' : '800'} м²`;
}

// Переключение вкладок
function switchTab(tabName) {
    currentTab = tabName;
    
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(tabName).classList.add('active');
}

// Проверки для холодильной установки
function checkCoolingType(element) {
    const passes = element.value === 'modular';
    updateStatus('cooling', 1, passes);
    saveCoolingData();
}

function checkCoolingStandard(number, passes) {
    updateStatus('cooling', number, passes);
    saveCoolingData();
}

function checkCoolingPower(value) {
    if (!currentObject) return;
    const isLarge = currentObject.sizeCode == '1800';
    const minPower = isLarge ? 285 : 185;
    updateStatus('cooling', 3, value >= minPower);
    saveCoolingData();
}

function checkPowerConsumption(value) {
    if (!currentObject) return;
    const isLarge = currentObject.sizeCode == '1800';
    const maxPower = isLarge ? 220 : 155;
    updateStatus('cooling', 4, value <= maxPower);
    saveCoolingData();
}

// Проверки для освещения
function checkLightsStandard(number, passes) {
    updateStatus('lights', number, passes);
    saveLightsData();
}

function checkLightsCount(value) {
    if (!currentObject) return;
    // Стандарт для всех катков - 4 опоры
    updateStatus('lights', 6, value == 4);
    saveLightsData();
}

// Проверки для АБК
function checkAbkStandard(number, passes) {
    updateStatus('abk', number, passes);
    saveAbkData();
}

function checkAbkWalls(value) {
    const standardWalls = ['sml-acrylic', 'mdf-vandal', 'hpl-vandal'];
    const passes = standardWalls.includes(value);
    updateStatus('abk', 16, passes);
    
    // Показать поле для другого типа если выбран не стандартный
    const otherInput = document.getElementById('abk-walls-other');
    if (value && !standardWalls.includes(value) && value !== '') {
        otherInput.style.display = 'inline-block';
    } else {
        otherInput.style.display = 'none';
    }
    
    // Сохранить данные после изменения
    saveAbkData();
}

// Сохранение данных по АБК
function saveAbkData() {
    if (!currentObject) return;
    
    // Получаем значения radio buttons
    const abkFacadeRadio = document.querySelector('input[name="abk-facade"]:checked');
    const abkRalFacadeRadio = document.querySelector('input[name="abk-ral-facade"]:checked');
    const abkRoofRadio = document.querySelector('input[name="abk-roof"]:checked');
    const abkWindowsRadio = document.querySelector('input[name="abk-windows"]:checked');
    const abkDoorsRadio = document.querySelector('input[name="abk-doors"]:checked');
    const abkFloorRadio = document.querySelector('input[name="abk-floor"]:checked');
    const abkGatesAutoRadio = document.querySelector('input[name="abk-gates-auto"]:checked');
    const abkCoolingIntegrationRadio = document.querySelector('input[name="abk-cooling-integration"]:checked');
    const abkVentilationRadio = document.querySelector('input[name="abk-ventilation"]:checked');
    const abkRalWindowsRadio = document.querySelector('input[name="abk-ral-windows"]:checked');
    
    const data = {
        abkFacade: abkFacadeRadio ? abkFacadeRadio.value : '',
        abkRalFacade: abkRalFacadeRadio ? abkRalFacadeRadio.value : '',
        abkRoof: abkRoofRadio ? abkRoofRadio.value : '',
        abkWindows: abkWindowsRadio ? abkWindowsRadio.value : '',
        abkDoors: abkDoorsRadio ? abkDoorsRadio.value : '',
        abkFloor: abkFloorRadio ? abkFloorRadio.value : '',
        abkGatesAuto: abkGatesAutoRadio ? abkGatesAutoRadio.value : '',
        abkCoolingIntegration: abkCoolingIntegrationRadio ? abkCoolingIntegrationRadio.value : '',
        abkVentilation: abkVentilationRadio ? abkVentilationRadio.value : '',
        abkRalWindows: abkRalWindowsRadio ? abkRalWindowsRadio.value : '',
        supplier: document.getElementById('abk-supplier').value,
        manufacturer: document.getElementById('abk-manufacturer').value,
        cost: document.getElementById('abk-cost').value,
        ceilingHeight: document.getElementById('abk-ceiling-height').value,
        gatesWidth: document.getElementById('abk-gates-width').value,
        gatesHeight: document.getElementById('abk-gates-height').value,
        ceilingType: document.getElementById('abk-ceiling-type').value,
        windowsHeight: document.getElementById('abk-windows-height').value,
        wallsType: document.getElementById('abk-walls-type').value,
        wallsOther: document.getElementById('abk-walls-other').value
    };

    console.log('🏢 Saving ABK data:', data);
    
    allObjectsData[currentObject.id].abk.data = data;
    saveData();
}

// Проверки для хоккейного борта
function checkBoardsStandard(number, passes) {
    updateStatus('boards', number, passes);
    saveBoardsData();
}

function calculateUpperHeight() {
    const lowerHeight = document.getElementById('boards-lower-height').value;
    if (lowerHeight) {
        const requiredUpper = 3000 - parseInt(lowerHeight);
        document.getElementById('boards-height-calc').textContent = 
            `(требуется ${requiredUpper} мм для общей высоты 3000 мм)`;
    }
}

function checkUpperHeight() {
    const lowerHeight = document.getElementById('boards-lower-height').value;
    const upperHeight = document.getElementById('boards-upper-height').value;
    
    if (lowerHeight && upperHeight) {
        const total = parseInt(lowerHeight) + parseInt(upperHeight);
        const passes = total >= 3000;
        updateStatus('boards', 5, passes);
        
        document.getElementById('boards-height-calc').textContent = 
            `(сумма: ${total} мм ${passes ? '✓' : '✗'})`;
    } else {
        // Если одно из значений не заполнено, статус остается pending
        updateStatus('boards', 5, null);
        if (lowerHeight && !upperHeight) {
            const requiredUpper = 3000 - parseInt(lowerHeight);
            document.getElementById('boards-height-calc').textContent = 
                `(требуется ${requiredUpper} мм для общей высоты 3000 мм)`;
        }
    }
}

// Проверки для инженерных систем
function checkSystemsStandard(number, passes) {
    updateStatus('systems', number, passes);
    saveSystemsData();
}

function checkSystemsAirExchange(value) {
    // Минимальная кратность для раздевалок - 5 раз/час (самое строгое требование)
    const passes = value >= 5;
    updateStatus('systems', 1, passes);
    saveSystemsData();
}

function checkSystemsCCTV() {
    const value = document.getElementById('systems-cctv-internal').value;
    // Минимум 8 камер для внутреннего наблюдения
    updateStatus('systems', 7, value >= 8);
    saveSystemsData();
}

function checkSystemsCCTVExternal() {
    const value = document.getElementById('systems-cctv-external').value;
    // Минимум 4 камеры для внешнего наблюдения
    updateStatus('systems', 8, value >= 4);
    saveSystemsData();
}

// Сохранение данных по инженерным системам
function saveSystemsData() {
    if (!currentObject) return;
    
    // Получаем значения radio buttons
    const systemsVentilationRadio = document.querySelector('input[name="systems-ventilation"]:checked');
    const systemsAcRadio = document.querySelector('input[name="systems-ac"]:checked');
    const systemsSoueRadio = document.querySelector('input[name="systems-soue"]:checked');
    const systemsFireRadio = document.querySelector('input[name="systems-fire"]:checked');
    const systemsLightingControlRadio = document.querySelector('input[name="systems-lighting-control"]:checked');
    const systemsSkudRadio = document.querySelector('input[name="systems-skud"]:checked');
    const systemsPumpRadio = document.querySelector('input[name="systems-pump"]:checked');
    
    const data = {
        // Radio buttons
        systemsVentilation: systemsVentilationRadio ? systemsVentilationRadio.value : '',
        systemsAc: systemsAcRadio ? systemsAcRadio.value : '',
        systemsSoue: systemsSoueRadio ? systemsSoueRadio.value : '',
        systemsFire: systemsFireRadio ? systemsFireRadio.value : '',
        systemsLightingControl: systemsLightingControlRadio ? systemsLightingControlRadio.value : '',
        systemsSkud: systemsSkudRadio ? systemsSkudRadio.value : '',
        systemsPump: systemsPumpRadio ? systemsPumpRadio.value : '',
        
        // Number/Text inputs
        airExchange: document.getElementById('systems-air-exchange').value,
        ventilationManufacturer: document.getElementById('systems-ventilation-manufacturer').value,
        ventilationCost: document.getElementById('systems-ventilation-cost').value,
        acManufacturer: document.getElementById('systems-ac-manufacturer').value,
        acCost: document.getElementById('systems-ac-cost').value,
        soueManufacturer: document.getElementById('systems-soue-manufacturer').value,
        soueCost: document.getElementById('systems-soue-cost').value,
        fireManufacturer: document.getElementById('systems-fire-manufacturer').value,
        fireCost: document.getElementById('systems-fire-cost').value,
        lightingManufacturer: document.getElementById('systems-lighting-manufacturer').value,
        lightingCost: document.getElementById('systems-lighting-cost').value,
        cctvInternal: document.getElementById('systems-cctv-internal').value,
        cctvExternal: document.getElementById('systems-cctv-external').value,
        cctvManufacturer: document.getElementById('systems-cctv-manufacturer').value,
        cctvCost: document.getElementById('systems-cctv-cost').value,
        skudManufacturer: document.getElementById('systems-skud-manufacturer').value,
        skudCost: document.getElementById('systems-skud-cost').value
    };

    console.log('⚙️ Saving systems data:', data);
    
    allObjectsData[currentObject.id].systems.data = data;
    saveData();
}

// Проверки для ледозаливочной машины
function checkIceStandard(number, passes) {
    updateStatus('ice', number, passes);
    saveIceData();
}

function checkIceArea(value) {
    if (!currentObject) return;
    const isLarge = currentObject.sizeCode == '1800';
    const minArea = isLarge ? 1800 : 800;
    updateStatus('ice', 2, value >= minArea);
}

// Сохранение данных по холодильной установке
function saveCoolingData() {
    if (!currentObject) return;
    
    // Получаем значение radio button для cooling-type
    const coolingTypeRadio = document.querySelector('input[name="cooling-type"]:checked');
    
    const data = {
        coolingType: coolingTypeRadio ? coolingTypeRadio.value : '',
        manufacturer: document.getElementById('cooling-manufacturer').value,
        cost: document.getElementById('cooling-cost').value,
        liquidVolume: document.getElementById('cooling-liquid-volume').value,
        liquidCost: document.getElementById('cooling-liquid-cost').value,
        refrigerant: document.getElementById('cooling-refrigerant').value,
        power: document.getElementById('cooling-power').value,
        consumption: document.getElementById('cooling-consumption').value,
        noise: document.getElementById('cooling-noise').value,
        pipes: document.getElementById('cooling-pipes').value,
        joints: document.getElementById('cooling-joints').value
    };

    console.log('💾 Saving cooling data:', data);

    allObjectsData[currentObject.id].cooling.data = data;
    saveData();
}

// Сохранение данных по освещению
function saveLightsData() {
    if (!currentObject) return;
    
    // Получаем значения radio buttons
    const lightsEquipmentRadio = document.querySelector('input[name="lights-equipment"]:checked');
    const lightsBoardRadio = document.querySelector('input[name="lights-board"]:checked');
    const lightsTribuneRadio = document.querySelector('input[name="lights-tribune"]:checked');
    const lightsAbkRadio = document.querySelector('input[name="lights-abk"]:checked');
    
    const data = {
        lightsEquipment: lightsEquipmentRadio ? lightsEquipmentRadio.value : '',
        lightsBoard: lightsBoardRadio ? lightsBoardRadio.value : '',
        lightsTribune: lightsTribuneRadio ? lightsTribuneRadio.value : '',
        lightsAbk: lightsAbkRadio ? lightsAbkRadio.value : '',
        manufacturerPoles: document.getElementById('lights-manufacturer-poles').value,
        costPoles: document.getElementById('lights-cost-poles').value,
        manufacturerAhp: document.getElementById('lights-manufacturer-ahp').value,
        costAhp: document.getElementById('lights-cost-ahp').value,
        height: document.getElementById('lights-height').value,
        count: document.getElementById('lights-count').value
    };

    console.log('💡 Saving lights data:', data);
    
    allObjectsData[currentObject.id].lights.data = data;
    saveData();
}

// Сохранение данных по хоккейному борту
function saveBoardsData() {
    if (!currentObject) return;
    
    // Получаем значения radio buttons
    const boardsZincRadio = document.querySelector('input[name="boards-zinc"]:checked');
    const boardsRgbwRadio = document.querySelector('input[name="boards-rgbw"]:checked');
    const boardsDmxRadio = document.querySelector('input[name="boards-dmx"]:checked');
    const boardsInnerScratchRadio = document.querySelector('input[name="boards-inner-scratch"]:checked');
    const boardsOuterScratchRadio = document.querySelector('input[name="boards-outer-scratch"]:checked');
    const boardsPanelRadio = document.querySelector('input[name="boards-panel"]:checked');
    const boardsAluminumRadio = document.querySelector('input[name="boards-aluminum"]:checked');
    
    const data = {
        boardsZinc: boardsZincRadio ? boardsZincRadio.value : '',
        boardsRgbw: boardsRgbwRadio ? boardsRgbwRadio.value : '',
        boardsDmx: boardsDmxRadio ? boardsDmxRadio.value : '',
        boardsInnerScratch: boardsInnerScratchRadio ? boardsInnerScratchRadio.value : '',
        boardsOuterScratch: boardsOuterScratchRadio ? boardsOuterScratchRadio.value : '',
        boardsPanel: boardsPanelRadio ? boardsPanelRadio.value : '',
        boardsAluminum: boardsAluminumRadio ? boardsAluminumRadio.value : '',
        manufacturer: document.getElementById('boards-manufacturer').value,
        cost: document.getElementById('boards-cost').value,
        frameThickness: document.getElementById('boards-frame-thickness').value,
        totalHeight: document.getElementById('boards-total-height').value,
        lowerHeight: document.getElementById('boards-lower-height').value,
        upperHeight: document.getElementById('boards-upper-height').value,
        innerThickness: document.getElementById('boards-inner-thickness').value,
        outerThickness: document.getElementById('boards-outer-thickness').value,
        glassThickness: document.getElementById('boards-glass-thickness').value
    };
    
    allObjectsData[currentObject.id].boards.data = data;
    saveData();
}

// Сохранение данных по ледозаливочной машине
function saveIceData() {
    if (!currentObject) return;
    
    // Получаем значение radio button для ice-engine
    const iceEngineRadio = document.querySelector('input[name="ice-engine"]:checked');
    
    const data = {
        iceEngine: iceEngineRadio ? iceEngineRadio.value : '',
        manufacturer: document.getElementById('ice-manufacturer').value,
        cost: document.getElementById('ice-cost').value,
        area: document.getElementById('ice-area').value,
        height: document.getElementById('ice-height').value,
        heightDriver: document.getElementById('ice-height-driver').value,
        length: document.getElementById('ice-length').value,
        width: document.getElementById('ice-width').value,
        weight: document.getElementById('ice-weight').value
    };
    
    allObjectsData[currentObject.id].ice.data = data;
    saveData();
}

// Обновление статуса
function updateStatus(category, number, passes) {
    if (!currentObject) return;
    
    const statusId = `${category}-status-${number}`;
    const statusElement = document.getElementById(statusId);
    
    if (statusElement) {
        if (passes === null || passes === undefined || passes === '') {
            statusElement.className = 'status-indicator status-pending';
            statusElement.textContent = 'Не заполнено';
            allObjectsData[currentObject.id][category].statuses[number] = 'pending';
        } else if (passes === true || passes === 'true') {
            statusElement.className = 'status-indicator status-pass';
            statusElement.textContent = '✓ Соответствует';
            allObjectsData[currentObject.id][category].statuses[number] = 'pass';
        } else {
            statusElement.className = 'status-indicator status-fail';
            statusElement.textContent = '✗ Не соответствует';
            allObjectsData[currentObject.id][category].statuses[number] = 'fail';
        }
    }
    
    saveData();
    updateSummaryTable();
}

// Универсальная функция сохранения данных
function saveData() {
    if (useFirebase) {
        saveToFirebase();
    } else {
        saveToLocalStorage();
    }
}

// Сохранение в Firebase
function saveToFirebase() {
    if (!database) return;
    
    isSyncing = true; // Устанавливаем флаг для предотвращения циклических обновлений
    
    database.ref('equipmentCheckData').set(allObjectsData)
        .then(() => {
            console.log('✅ Данные сохранены в Firebase');
            isSyncing = false;
        })
        .catch((error) => {
            console.error('❌ Ошибка сохранения в Firebase:', error);
            // Резервное сохранение в localStorage
            saveToLocalStorage();
            isSyncing = false;
        });
}

// Сохранение в localStorage (резервный вариант)
function saveToLocalStorage() {
    localStorage.setItem('equipmentCheckData', JSON.stringify(allObjectsData));
    console.log('💾 Данные сохранены в localStorage');
}

// Загрузка данных из Firebase
function loadAllDataFromFirebase() {
    if (!database) {
        loadAllDataFromLocalStorage();
        return;
    }
    
    database.ref('equipmentCheckData').once('value')
        .then((snapshot) => {
            const data = snapshot.val();
            if (data) {
                console.log('📥 Данные загружены из Firebase');
                Object.keys(data).forEach(objId => {
                    if (allObjectsData[objId]) {
                        allObjectsData[objId] = mergeDeep(allObjectsData[objId], data[objId]);
                    }
                });
                updateSummaryTable();
            } else {
                console.log('ℹ️ Нет данных в Firebase, используем локальные');
                loadAllDataFromLocalStorage();
            }
        })
        .catch((error) => {
            console.error('❌ Ошибка загрузки из Firebase:', error);
            loadAllDataFromLocalStorage();
        });
}

// Ручное обновление данных с сервера
function refreshDataFromServer() {
    if (!useFirebase || !database) {
        showNotification('⚠️ Firebase не подключен, используется локальный режим');
        return;
    }
    
    const refreshBtn = document.querySelector('.refresh-btn');
    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.textContent = '⏳ Загрузка...';
    }
    
    console.log('🔄 Запрос обновления данных с сервера...');
    
    database.ref('equipmentCheckData').once('value')
        .then((snapshot) => {
            const data = snapshot.val();
            if (data) {
                console.log('✅ Данные успешно обновлены с сервера');
                Object.keys(data).forEach(objId => {
                    if (allObjectsData[objId]) {
                        allObjectsData[objId] = mergeDeep(allObjectsData[objId], data[objId]);
                    }
                });
                
                // Обновляем UI
                updateSummaryTable();
                
                // Если открыт детальный вид, обновляем его
                if (currentObject) {
                    loadObjectDataFromStorage();
                }
                
                showNotification('✅ Данные обновлены с сервера');
            } else {
                console.log('ℹ️ Нет данных на сервере');
                showNotification('ℹ️ Нет данных на сервере');
            }
        })
        .catch((error) => {
            console.error('❌ Ошибка обновления данных:', error);
            showNotification('❌ Ошибка обновления: ' + error.message);
        })
        .finally(() => {
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.textContent = '🔄 Обновить данные';
            }
        });
}

// Загрузка данных из localStorage
function loadAllDataFromLocalStorage() {
    const saved = localStorage.getItem('equipmentCheckData');
    if (saved) {
        const parsedData = JSON.parse(saved);
        Object.keys(parsedData).forEach(objId => {
            if (allObjectsData[objId]) {
                Object.keys(parsedData[objId]).forEach(category => {
                    if (allObjectsData[objId][category]) {
                        allObjectsData[objId][category] = mergeDeep(
                            allObjectsData[objId][category], 
                            parsedData[objId][category]
                        );
                    }
                });
            }
        });
        console.log('💾 Данные загружены из localStorage');
    }
}

// Вспомогательная функция для восстановления radio button с миграцией
function restoreRadioButton(radioName, savedValue, statusCategory, statusNumber) {
    console.log(`🔍 Restoring radio: ${radioName}, savedValue: "${savedValue}", status: ${statusCategory}[${statusNumber}]`);
    
    if (savedValue) {
        const radioButton = document.querySelector(`input[name="${radioName}"][value="${savedValue}"]`);
        console.log(`🔎 Looking for: input[name="${radioName}"][value="${savedValue}"]`, radioButton);
        if (radioButton) {
            radioButton.checked = true;
            console.log(`✅ Restored ${radioName} to ${savedValue} - checked: ${radioButton.checked}`);
        } else {
            console.warn(`❌ Could not find radio button: input[name="${radioName}"][value="${savedValue}"]`);
        }
    } else if (!currentObject) {
        console.log(`⚠️ No currentObject, skipping migration`);
        return;
    } else {
        // Миграция: определяем значение из статуса
        const status = allObjectsData[currentObject.id][statusCategory].statuses[statusNumber];
        console.log(`📊 Status for ${statusCategory}[${statusNumber}]: ${status}`);
        
        if (status === 'pass') {
            const radioButton = document.querySelector(`input[name="${radioName}"][value="yes"]`) || 
                               document.querySelector(`input[name="${radioName}"][value="modular"]`) ||
                               document.querySelector(`input[name="${radioName}"][value="dvs"]`);
            if (radioButton) {
                radioButton.checked = true;
                console.log(`✅ Migrated ${radioName} to ${radioButton.value} (from pass status)`);
            } else {
                console.warn(`❌ Could not find any radio button for ${radioName} migration (pass)`);
            }
        } else if (status === 'fail') {
            const radioButton = document.querySelector(`input[name="${radioName}"][value="no"]`) ||
                               document.querySelector(`input[name="${radioName}"][value="other"]`) ||
                               document.querySelector(`input[name="${radioName}"][value="electric"]`);
            if (radioButton) {
                radioButton.checked = true;
                console.log(`✅ Migrated ${radioName} to ${radioButton.value} (from fail status)`);
            } else {
                console.warn(`❌ Could not find any radio button for ${radioName} migration (fail)`);
            }
        }
    }
}

// Загрузка данных объекта из хранилища
function loadObjectDataFromStorage() {
    if (!currentObject) return;
    
    // Сброс всех полей ввода перед загрузкой
    document.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.checked = false;
    });
    document.querySelectorAll('select.select-input').forEach(select => {
        if (select.id) {
            select.value = '';
        }
    });
    document.querySelectorAll('input.number-input, input.text-input').forEach(input => {
        if (input.id && !input.id.includes('status')) {
            input.value = '';
        }
    });
    
    // Сброс всех статусов на "Не заполнено"
    document.querySelectorAll('.status-indicator').forEach(status => {
        if (status.id.includes('status')) {
            status.className = 'status-indicator status-pending';
            status.textContent = 'Не заполнено';
        }
    });
    
    const data = allObjectsData[currentObject.id];
    
    // Загрузка данных холодильной установки
    if (data.cooling.data) {
        const coolingData = data.cooling.data;
        
        // Восстановить radio button для cooling-type с миграцией
        restoreRadioButton('cooling-type', coolingData.coolingType, 'cooling', 1);
        
        if (coolingData.manufacturer) document.getElementById('cooling-manufacturer').value = coolingData.manufacturer;
        if (coolingData.cost) document.getElementById('cooling-cost').value = coolingData.cost;
        if (coolingData.liquidVolume) document.getElementById('cooling-liquid-volume').value = coolingData.liquidVolume;
        if (coolingData.liquidCost) document.getElementById('cooling-liquid-cost').value = coolingData.liquidCost;
        if (coolingData.refrigerant) document.getElementById('cooling-refrigerant').value = coolingData.refrigerant;
        if (coolingData.power) document.getElementById('cooling-power').value = coolingData.power;
        if (coolingData.consumption) document.getElementById('cooling-consumption').value = coolingData.consumption;
        if (coolingData.noise) document.getElementById('cooling-noise').value = coolingData.noise;
        if (coolingData.pipes) document.getElementById('cooling-pipes').value = coolingData.pipes;
        if (coolingData.joints) document.getElementById('cooling-joints').value = coolingData.joints;
    }
    
    // Загрузка данных освещения
    if (data.lights.data) {
        const lightsData = data.lights.data;
        
        // Восстановить radio buttons с миграцией
        restoreRadioButton('lights-equipment', lightsData.lightsEquipment, 'lights', 1);
        restoreRadioButton('lights-board', lightsData.lightsBoard, 'lights', 3);
        restoreRadioButton('lights-tribune', lightsData.lightsTribune, 'lights', 4);
        restoreRadioButton('lights-abk', lightsData.lightsAbk, 'lights', 5);
        
        if (lightsData.manufacturerPoles) document.getElementById('lights-manufacturer-poles').value = lightsData.manufacturerPoles;
        if (lightsData.costPoles) document.getElementById('lights-cost-poles').value = lightsData.costPoles;
        if (lightsData.manufacturerAhp) document.getElementById('lights-manufacturer-ahp').value = lightsData.manufacturerAhp;
        if (lightsData.costAhp) document.getElementById('lights-cost-ahp').value = lightsData.costAhp;
        if (lightsData.height) document.getElementById('lights-height').value = lightsData.height;
        if (lightsData.count) document.getElementById('lights-count').value = lightsData.count;
    }
    
    // Загрузка данных АБК
    if (data.abk.data) {
        const abkData = data.abk.data;
        
        // Восстановить radio buttons с миграцией
        restoreRadioButton('abk-facade', abkData.abkFacade, 'abk', 1);
        restoreRadioButton('abk-ral-facade', abkData.abkRalFacade, 'abk', 2);
        restoreRadioButton('abk-roof', abkData.abkRoof, 'abk', 3);
        restoreRadioButton('abk-windows', abkData.abkWindows, 'abk', 4);
        restoreRadioButton('abk-doors', abkData.abkDoors, 'abk', 5);
        restoreRadioButton('abk-floor', abkData.abkFloor, 'abk', 7);
        restoreRadioButton('abk-gates-auto', abkData.abkGatesAuto, 'abk', 8);
        restoreRadioButton('abk-cooling-integration', abkData.abkCoolingIntegration, 'abk', 12);
        restoreRadioButton('abk-ventilation', abkData.abkVentilation, 'abk', 13);
        restoreRadioButton('abk-ral-windows', abkData.abkRalWindows, 'abk', 15);
        
        if (abkData.supplier) document.getElementById('abk-supplier').value = abkData.supplier;
        if (abkData.manufacturer) document.getElementById('abk-manufacturer').value = abkData.manufacturer;
        if (abkData.cost) document.getElementById('abk-cost').value = abkData.cost;
        if (abkData.ceilingHeight) document.getElementById('abk-ceiling-height').value = abkData.ceilingHeight;
        if (abkData.gatesWidth) document.getElementById('abk-gates-width').value = abkData.gatesWidth;
        if (abkData.gatesHeight) document.getElementById('abk-gates-height').value = abkData.gatesHeight;
        if (abkData.ceilingType) document.getElementById('abk-ceiling-type').value = abkData.ceilingType;
        if (abkData.windowsHeight) document.getElementById('abk-windows-height').value = abkData.windowsHeight;
        if (abkData.wallsType) document.getElementById('abk-walls-type').value = abkData.wallsType;
        if (abkData.wallsOther) document.getElementById('abk-walls-other').value = abkData.wallsOther;
        
        // Показать поле для другого типа стен если нужно
        if (abkData.wallsType && !['sml-acrylic', 'mdf-vandal', 'hpl-vandal', ''].includes(abkData.wallsType)) {
            document.getElementById('abk-walls-other').style.display = 'inline-block';
        }
    }
    
    // Загрузка данных хоккейного борта
    if (data.boards.data) {
        const boardsData = data.boards.data;
        
        // Восстановить radio buttons с миграцией
        restoreRadioButton('boards-zinc', boardsData.boardsZinc, 'boards', 1);
        restoreRadioButton('boards-rgbw', boardsData.boardsRgbw, 'boards', 6);
        restoreRadioButton('boards-dmx', boardsData.boardsDmx, 'boards', 7);
        restoreRadioButton('boards-inner-scratch', boardsData.boardsInnerScratch, 'boards', 8);
        restoreRadioButton('boards-outer-scratch', boardsData.boardsOuterScratch, 'boards', 10);
        restoreRadioButton('boards-panel', boardsData.boardsPanel, 'boards', 12);
        restoreRadioButton('boards-aluminum', boardsData.boardsAluminum, 'boards', 13);
        
        if (boardsData.manufacturer) document.getElementById('boards-manufacturer').value = boardsData.manufacturer;
        if (boardsData.cost) document.getElementById('boards-cost').value = boardsData.cost;
        if (boardsData.frameThickness) document.getElementById('boards-frame-thickness').value = boardsData.frameThickness;
        if (boardsData.totalHeight) document.getElementById('boards-total-height').value = boardsData.totalHeight;
        if (boardsData.lowerHeight) document.getElementById('boards-lower-height').value = boardsData.lowerHeight;
        if (boardsData.upperHeight) document.getElementById('boards-upper-height').value = boardsData.upperHeight;
        if (boardsData.innerThickness) document.getElementById('boards-inner-thickness').value = boardsData.innerThickness;
        if (boardsData.outerThickness) document.getElementById('boards-outer-thickness').value = boardsData.outerThickness;
        if (boardsData.glassThickness) document.getElementById('boards-glass-thickness').value = boardsData.glassThickness;
    }
    
    // Загрузка данных инженерных систем
    if (data.systems.data) {
        const systemsData = data.systems.data;
        
        // Восстановить radio buttons с миграцией
        restoreRadioButton('systems-ventilation', systemsData.systemsVentilation, 'systems', 2);
        restoreRadioButton('systems-ac', systemsData.systemsAc, 'systems', 3);
        restoreRadioButton('systems-soue', systemsData.systemsSoue, 'systems', 4);
        restoreRadioButton('systems-fire', systemsData.systemsFire, 'systems', 5);
        restoreRadioButton('systems-lighting-control', systemsData.systemsLightingControl, 'systems', 6);
        restoreRadioButton('systems-skud', systemsData.systemsSkud, 'systems', 9);
        restoreRadioButton('systems-pump', systemsData.systemsPump, 'systems', 10);
        
        if (systemsData.airExchange) document.getElementById('systems-air-exchange').value = systemsData.airExchange;
        if (systemsData.ventilationManufacturer) document.getElementById('systems-ventilation-manufacturer').value = systemsData.ventilationManufacturer;
        if (systemsData.ventilationCost) document.getElementById('systems-ventilation-cost').value = systemsData.ventilationCost;
        if (systemsData.acManufacturer) document.getElementById('systems-ac-manufacturer').value = systemsData.acManufacturer;
        if (systemsData.acCost) document.getElementById('systems-ac-cost').value = systemsData.acCost;
        if (systemsData.soueManufacturer) document.getElementById('systems-soue-manufacturer').value = systemsData.soueManufacturer;
        if (systemsData.soueCost) document.getElementById('systems-soue-cost').value = systemsData.soueCost;
        if (systemsData.fireManufacturer) document.getElementById('systems-fire-manufacturer').value = systemsData.fireManufacturer;
        if (systemsData.fireCost) document.getElementById('systems-fire-cost').value = systemsData.fireCost;
        if (systemsData.lightingManufacturer) document.getElementById('systems-lighting-manufacturer').value = systemsData.lightingManufacturer;
        if (systemsData.lightingCost) document.getElementById('systems-lighting-cost').value = systemsData.lightingCost;
        if (systemsData.cctvInternal) document.getElementById('systems-cctv-internal').value = systemsData.cctvInternal;
        if (systemsData.cctvExternal) document.getElementById('systems-cctv-external').value = systemsData.cctvExternal;
        if (systemsData.cctvManufacturer) document.getElementById('systems-cctv-manufacturer').value = systemsData.cctvManufacturer;
        if (systemsData.cctvCost) document.getElementById('systems-cctv-cost').value = systemsData.cctvCost;
        if (systemsData.skudManufacturer) document.getElementById('systems-skud-manufacturer').value = systemsData.skudManufacturer;
        if (systemsData.skudCost) document.getElementById('systems-skud-cost').value = systemsData.skudCost;
    }
    
    // Загрузка данных ледозаливочной машины
    if (data.ice.data) {
        const iceData = data.ice.data;
        
        // Восстановить radio button для ice-engine с миграцией
        restoreRadioButton('ice-engine', iceData.iceEngine, 'ice', 1);
        
        if (iceData.manufacturer) document.getElementById('ice-manufacturer').value = iceData.manufacturer;
        if (iceData.cost) document.getElementById('ice-cost').value = iceData.cost;
        if (iceData.area) document.getElementById('ice-area').value = iceData.area;
        if (iceData.height) document.getElementById('ice-height').value = iceData.height;
        if (iceData.heightDriver) document.getElementById('ice-height-driver').value = iceData.heightDriver;
        if (iceData.length) document.getElementById('ice-length').value = iceData.length;
        if (iceData.width) document.getElementById('ice-width').value = iceData.width;
        if (iceData.weight) document.getElementById('ice-weight').value = iceData.weight;
    }
    
    // Обновление статусов для холодильной установки
    for (let i = 1; i <= 7; i++) {
        const status = data.cooling.statuses[i];
        if (status && status !== 'pending') {
            const statusElement = document.getElementById(`cooling-status-${i}`);
            if (statusElement) {
                if (status === 'pass') {
                    statusElement.className = 'status-indicator status-pass';
                    statusElement.textContent = '✓ Соответствует';
                } else {
                    statusElement.className = 'status-indicator status-fail';
                    statusElement.textContent = '✗ Не соответствует';
                }
            }
        }
    }
    
    // Обновление статусов для освещения
    for (let i = 1; i <= 6; i++) {
        const status = data.lights.statuses[i];
        if (status && status !== 'pending') {
            const statusElement = document.getElementById(`lights-status-${i}`);
            if (statusElement) {
                if (status === 'pass') {
                    statusElement.className = 'status-indicator status-pass';
                    statusElement.textContent = '✓ Соответствует';
                } else {
                    statusElement.className = 'status-indicator status-fail';
                    statusElement.textContent = '✗ Не соответствует';
                }
            }
        }
    }
    
    // Обновление статусов для АБК
    for (let i = 1; i <= 16; i++) {
        const status = data.abk.statuses[i];
        if (status && status !== 'pending') {
            const statusElement = document.getElementById(`abk-status-${i}`);
            if (statusElement) {
                if (status === 'pass') {
                    statusElement.className = 'status-indicator status-pass';
                    statusElement.textContent = '✓ Соответствует';
                } else {
                    statusElement.className = 'status-indicator status-fail';
                    statusElement.textContent = '✗ Не соответствует';
                }
            }
        }
    }
    
    // Обновление статусов для хоккейного борта
    for (let i = 1; i <= 14; i++) {
        const status = data.boards.statuses[i];
        if (status && status !== 'pending') {
            const statusElement = document.getElementById(`boards-status-${i}`);
            if (statusElement) {
                if (status === 'pass') {
                    statusElement.className = 'status-indicator status-pass';
                    statusElement.textContent = '✓ Соответствует';
                } else {
                    statusElement.className = 'status-indicator status-fail';
                    statusElement.textContent = '✗ Не соответствует';
                }
            }
        }
    }
    
    // Обновление статусов для инженерных систем
    for (let i = 1; i <= 10; i++) {
        const status = data.systems.statuses[i];
        if (status && status !== 'pending') {
            const statusElement = document.getElementById(`systems-status-${i}`);
            if (statusElement) {
                if (status === 'pass') {
                    statusElement.className = 'status-indicator status-pass';
                    statusElement.textContent = '✓ Соответствует';
                } else {
                    statusElement.className = 'status-indicator status-fail';
                    statusElement.textContent = '✗ Не соответствует';
                }
            }
        }
    }
    
    // Обновление статусов для ледозаливочной машины
    for (let i = 1; i <= 7; i++) {
        const status = data.ice.statuses[i];
        if (status && status !== 'pending') {
            const statusElement = document.getElementById(`ice-status-${i}`);
            if (statusElement) {
                if (status === 'pass') {
                    statusElement.className = 'status-indicator status-pass';
                    statusElement.textContent = '✓ Соответствует';
                } else {
                    statusElement.className = 'status-indicator status-fail';
                    statusElement.textContent = '✗ Не соответствует';
                }
            }
        }
    }
    
    // Пересчет высоты борта если есть данные
    if (data.boards.data && data.boards.data.lowerHeight) {
        calculateUpperHeight();
        if (data.boards.data.upperHeight) {
            checkUpperHeight();
        }
    }
}

// Экспорт сводной таблицы
function exportSummary() {
    const BOM = '\uFEFF';
    let csvContent = BOM;
    csvContent += "Сводный отчет проверки соответствия оборудования стандартам\n";
    csvContent += `Дата формирования:;${new Date().toLocaleDateString('ru-RU')}\n\n`;
    
    csvContent += "№;Объект;Округ;Размер;Холодильная установка;Освещение;АБК;Хоккейный борт;Оснащение АБК;Инженерные системы;Ледозаливочная машина;% соответствия;";
    csvContent += "Производитель ХУ;Стоимость ХУ;Объем хладагента;Стоимость хладагента;";
    csvContent += "Производитель опор;Стоимость опор;Производитель АХП;Стоимость АХП;";
    csvContent += "Производитель борта;Стоимость борта;";
    csvContent += "Производитель ледозаливочной;Стоимость ледозаливочной\n";
    
    objects.forEach(obj => {
        const data = allObjectsData[obj.id];
        const sections = ['cooling', 'lights', 'abk', 'boards', 'furniture', 'systems', 'ice'];
        const statuses = [];
        let totalPass = 0;
        let totalFail = 0;
        
        sections.forEach(section => {
            let pass = 0, fail = 0, pending = 0;
            
            if (section === 'cooling') {
                for (let i = 1; i <= 7; i++) {
                    const status = data.cooling.statuses[i];
                    if (status === 'pass') pass++;
                    else if (status === 'fail') fail++;
                    else pending++;
                }
            } else if (section === 'lights') {
                for (let i = 1; i <= 6; i++) {
                    const status = data.lights.statuses[i];
                    if (status === 'pass') pass++;
                    else if (status === 'fail') fail++;
                    else pending++;
                }
            } else if (section === 'abk') {
                for (let i = 1; i <= 16; i++) {
                    const status = data.abk.statuses[i];
                    if (status === 'pass') pass++;
                    else if (status === 'fail') fail++;
                    else pending++;
                }
            } else if (section === 'boards') {
                for (let i = 1; i <= 14; i++) {
                    const status = data.boards.statuses[i];
                    if (status === 'pass') pass++;
                    else if (status === 'fail') fail++;
                    else pending++;
                }
            } else if (section === 'systems') {
                for (let i = 1; i <= 10; i++) {
                    const status = data.systems.statuses[i];
                    if (status === 'pass') pass++;
                    else if (status === 'fail') fail++;
                    else pending++;
                }
            } else if (section === 'ice') {
                for (let i = 1; i <= 7; i++) {
                    const status = data.ice.statuses[i];
                    if (status === 'pass') pass++;
                    else if (status === 'fail') fail++;
                    else pending++;
                }
            }
            
            totalPass += pass;
            totalFail += fail;
            
            if (fail > 0) {
                statuses.push(`✗ (${fail})`);
            } else if (pending > 0) {
                statuses.push(`⏳ (${pending})`);
            } else if (pass > 0) {
                statuses.push(`✓ (${pass})`);
            } else {
                statuses.push('—');
            }
        });
        
        const compliance = totalPass + totalFail > 0 
            ? Math.round((totalPass / (totalPass + totalFail)) * 100) 
            : 0;
        
        const coolingData = data.cooling.data || {};
        const lightsData = data.lights.data || {};
        const boardsData = data.boards.data || {};
        const iceData = data.ice.data || {};
        
        csvContent += `${obj.id};${obj.name};${obj.district};${obj.size};`;
        csvContent += statuses.join(';') + ';';
        csvContent += `${compliance}%;`;
        csvContent += `${coolingData.manufacturer || ''};`;
        csvContent += `${coolingData.cost || ''};`;
        csvContent += `${coolingData.liquidVolume || ''};`;
        csvContent += `${coolingData.liquidCost || ''};`;
        csvContent += `${lightsData.manufacturerPoles || ''};`;
        csvContent += `${lightsData.costPoles || ''};`;
        csvContent += `${lightsData.manufacturerAhp || ''};`;
        csvContent += `${lightsData.costAhp || ''};`;
        csvContent += `${boardsData.manufacturer || ''};`;
        csvContent += `${boardsData.cost || ''};`;
        csvContent += `${iceData.manufacturer || ''};`;
        csvContent += `${iceData.cost || ''}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `сводная_проверка_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Печать сводки
function printSummary() {
    window.print();
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    initialize();
});
