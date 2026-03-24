CREATE TABLE users (  
    id INTEGER PRIMARY KEY AUTOINCREMENT,  
    username TEXT NOT NULL UNIQUE,  
    password TEXT NOT NULL
);

CREATE TABLE tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    techName TEXT NOT NULL,
    timeIn TEXT NOT NULL,
    timeOut TEXT,
    totalTime TEXT NOT NULL,
    customerName TEXT NOT NULL,
    customerAddress TEXT NOT NULL,
    customerPhone TEXT NOT NULL,
    customerEmail TEXT NOT NULL,
    vehicleYearMakeModel TEXT NOT NULL,
    vehicleVin TEXT NOT NULL,
    vehicleLicensePlate TEXT NOT NULL,
    vehicleMileageIn TEXT NOT NULL,
    vehicleMileageOut TEXT NOT NULL,
    concern TEXT NOT NULL,
    diagnosis TEXT NOT NULL,
    recommendedRepairs TEXT NOT NULL,
    dateSigned TEXT NOT NULL,
    customerSignature TEXT NOT NULL
);

CREATE TABLE recRepairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticketId INTEGER NOT NULL,
    repairDescription TEXT NOT NULL,
    qty INTEGER NOT NULL,
    partNumber TEXT NOT NULL,
    partPrice REAL NOT NULL,
    partsTotal REAL NOT NULL,
    laborHours REAL NOT NULL,
    laborTotal REAL NOT NULL
);

CREATE TABLE vechicleInfo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    color TEXT NOT NULL,
    Vin TEXT NOT NULL,
    mfgDate TEXT NOT NULL,
    engineSize TEXT NOT NULL,
    transType TEXT NOT NULL,
    currentMileage INTEGER NOT NULL,
    oldMileage INTEGER NOT NULL,
    technicain TEXT NOT NULL,
    
    plate TEXT NOT NULL,
    year INTEGER NOT NULL
);

CREATE TABLE Courtesy (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
);
