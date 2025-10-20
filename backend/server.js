const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Configuration DB (avec valeurs par défaut)
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', // Laisse vide si pas de mot de passe
    database: 'jobmatchai'
});

// Gestion connexion DB avec reconnexion automatique
function connectDB() {
    db.connect((err) => {
        if (err) {
            console.log('⏳ Tentative de connexion à MySQL...');
            setTimeout(connectDB, 2000);
        } else {
            console.log('✅ Connecté à MySQL');
            initializeDatabase();
        }
    });
}

function initializeDatabase() {
    // Créer la DB si elle n'existe pas
    db.query('CREATE DATABASE IF NOT EXISTS jobmatchai', (err) => {
        if (err) throw err;
        
        db.changeUser({ database: 'jobmatchai' }, (err) => {
            if (err) throw err;
            createTables();
        });
    });
}

function createTables() {
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS job_offers (
            id INT PRIMARY KEY AUTO_INCREMENT,
            title VARCHAR(255) NOT NULL,
            company VARCHAR(255) NOT NULL,
            location VARCHAR(100),
            description TEXT,
            requirements TEXT,
            skills_required JSON,
            salary_range VARCHAR(100),
            job_type VARCHAR(50),
            experience_level VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT TRUE
        )
    `;

    db.query(createTableSQL, (err) => {
        if (err) throw err;
        console.log('✅ Table job_offers créée');
        insertSampleData();
    });
}

function insertSampleData() {
    const checkSQL = 'SELECT COUNT(*) as count FROM job_offers';
    db.query(checkSQL, (err, results) => {
        if (err) throw err;
        
        if (results[0].count === 0) {
            console.log('📝 Insertion des offres exemple...');
            
            const sampleJobs = [
                {
                    title: "Développeur Fullstack JavaScript",
                    company: "TechCorp",
                    location: "Paris",
                    description: "Nous recherchons un développeur fullstack passionné pour rejoindre notre équipe technique. Vous travaillerez sur des projets innovants avec les dernières technologies.",
                    requirements: "Minimum 2 ans d'expérience en développement web, maîtrise de JavaScript et React",
                    skills_required: JSON.stringify(["javascript", "react", "node.js", "mongodb", "html", "css"]),
                    salary_range: "45k-55k €",
                    job_type: "CDI",
                    experience_level: "Mid-level"
                },
                {
                    title: "Data Scientist Python",
                    company: "DataCompany",
                    location: "Lyon", 
                    description: "Rejoignez notre équipe data science pour développer des modèles prédictifs innovants. Analyse de données et machine learning au quotidien.",
                    requirements: "Master en data science, expérience avec Python et machine learning",
                    skills_required: JSON.stringify(["python", "machine learning", "sql", "pandas", "numpy", "tensorflow"]),
                    salary_range: "50k-60k €",
                    job_type: "CDI",
                    experience_level: "Senior"
                },
                {
                    title: "Ingénieur DevOps",
                    company: "CloudSolutions", 
                    location: "Remote",
                    description: "Gestion de notre infrastructure cloud et automatisation des déploiements. Environnement technique stimulant.",
                    requirements: "Expérience avec AWS, Docker et Kubernetes, connaissance de Linux",
                    skills_required: JSON.stringify(["docker", "kubernetes", "aws", "linux", "python", "bash"]),
                    salary_range: "48k-58k €",
                    job_type: "CDI",
                    experience_level: "Mid-level"
                },
                {
                    title: "Développeur Mobile Flutter",
                    company: "AppFactory",
                    location: "Toulouse",
                    description: "Développement d'applications mobiles cross-platform avec Flutter. Rejoignez une équipe jeune et dynamique.",
                    requirements: "Expérience avec Flutter ou framework mobile, portfolio apprécié",
                    skills_required: JSON.stringify(["flutter", "dart", "android", "ios", "firebase"]),
                    salary_range: "40k-50k €",
                    job_type: "CDI",
                    experience_level: "Junior"
                },
                {
                    title: "Frontend Developer React",
                    company: "WebAgency",
                    location: "Bordeaux",
                    description: "Création d'interfaces utilisateur modernes et responsives. Travail sur des projets variés pour différents clients.",
                    requirements: "Bonnes connaissances en React, TypeScript et CSS moderne",
                    skills_required: JSON.stringify(["react", "typescript", "html", "css", "redux", "jest"]),
                    salary_range: "42k-52k €",
                    job_type: "CDI",
                    experience_level: "Mid-level"
                }
            ];

            const insertSQL = `
                INSERT INTO job_offers (title, company, location, description, requirements, skills_required, salary_range, job_type, experience_level) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            sampleJobs.forEach((job, index) => {
                db.query(insertSQL, [
                    job.title, job.company, job.location, job.description, 
                    job.requirements, job.skills_required, job.salary_range, 
                    job.job_type, job.experience_level
                ], (err) => {
                    if (err) throw err;
                    if (index === sampleJobs.length - 1) {
                        console.log(`✅ ${sampleJobs.length} offres d'emploi insérées`);
                    }
                });
            });
        } else {
            console.log('📊 Base de données déjà initialisée');
        }
    });
}

// Configuration upload CV
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = './uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Seuls les fichiers PDF sont acceptés'), false);
        }
    }
});

// 📄 ROUTE 1: Page d'accueil
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 📄 ROUTE 2: Obtenir toutes les offres d'emploi
app.get('/api/jobs', (req, res) => {
    const sql = 'SELECT * FROM job_offers WHERE is_active = TRUE ORDER BY created_at DESC';
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error('❌ Erreur DB:', err);
            return res.status(500).json({ error: 'Erreur base de données' });
        }
        
        // Convertir les skills JSON en objet
        const jobs = results.map(job => ({
            ...job,
            skills_required: JSON.parse(job.skills_required)
        }));
        
        res.json(jobs);
    });
});

// 📄 ROUTE 3: Upload et analyse de CV
app.post('/api/analyze-cv', upload.single('cv'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Aucun fichier uploadé' });
        }

        console.log('📄 CV reçu:', req.file.filename);

        // Pour la démo, on simule l'extraction de texte
        // Dans la vraie version, tu utiliserais pdf-parse
        const simulatedCVText = `
            DÉVELOPPEUR FULLSTACK
            Expérience: 3 ans
            Compétences: JavaScript, React, Node.js, MongoDB, HTML, CSS, Python
            Projets: Développement d'applications web, APIs REST, bases de données
            Formation: Master en informatique
            Langues: Français, Anglais
        `;

        const userSkills = analyzeCVSkills(simulatedCVText);
        console.log('🔍 Compétences détectées:', Object.keys(userSkills));
        
        const matchingJobs = await findMatchingJobs(userSkills);
        
        res.json({
            success: true,
            userSkills: userSkills,
            matchingJobs: matchingJobs,
            totalMatches: matchingJobs.length
        });

    } catch (error) {
        console.error('❌ Erreur analyse CV:', error);
        res.status(500).json({ error: 'Erreur lors de l\'analyse du CV: ' + error.message });
    }
});

// Fonction d'analyse des compétences
function analyzeCVSkills(cvText) {
    const skillsKeywords = {
        'javascript': ['javascript', 'js'],
        'react': ['react', 'react.js'],
        'node.js': ['node', 'node.js'],
        'python': ['python'],
        'java': ['java'],
        'sql': ['sql', 'mysql'],
        'mongodb': ['mongodb'],
        'docker': ['docker'],
        'aws': ['aws'],
        'html': ['html'],
        'css': ['css'],
        'typescript': ['typescript', 'ts'],
        'flutter': ['flutter'],
        'kubernetes': ['kubernetes'],
        'machine learning': ['machine learning', 'ml'],
        'tensorflow': ['tensorflow']
    };

    const foundSkills = {};
    const textLower = cvText.toLowerCase();

    Object.keys(skillsKeywords).forEach(skill => {
        skillsKeywords[skill].forEach(keyword => {
            if (textLower.includes(keyword)) {
                foundSkills[skill] = 0.8; // Score de confiance
            }
        });
    });

    return foundSkills;
}

// Fonction de matching des offres
function findMatchingJobs(userSkills) {
    return new Promise((resolve, reject) => {
        const sql = 'SELECT * FROM job_offers WHERE is_active = TRUE';
        
        db.query(sql, (err, allJobs) => {
            if (err) {
                reject(err);
                return;
            }

            const userSkillNames = Object.keys(userSkills);
            const matchingJobs = allJobs.map(job => {
                const jobSkills = JSON.parse(job.skills_required);
                const commonSkills = jobSkills.filter(skill => 
                    userSkillNames.includes(skill)
                );
                
                // Calcul du score de matching
                const matchScore = Math.round((commonSkills.length / jobSkills.length) * 100);
                
                return {
                    ...job,
                    skills_required: jobSkills,
                    matchScore: matchScore,
                    matchingSkills: commonSkills
                };
            }).filter(job => job.matchScore > 0) // Garder seulement ceux avec au moins 1 match
              .sort((a, b) => b.matchScore - a.matchScore); // Trier par score

            resolve(matchingJobs);
        });
    });
}

// Gestion des erreurs de connexion DB
db.on('error', (err) => {
    console.log('❌ Erreur DB:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        connectDB();
    } else {
        throw err;
    }
});

// Démarrer le serveur
app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
    console.log(`📊 API Jobs: http://localhost:${PORT}/api/jobs`);
    console.log(`📄 Upload CV: POST http://localhost:${PORT}/api/analyze-cv`);
    connectDB();
});