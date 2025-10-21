const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Configuration DB
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'jupiter',  // ⬅️ REMPLACE PAR TON VRAI MOT DE PASSE
    database: 'jobmatchai'
});

// Connexion à la base de données
db.connect((err) => {
    if (err) {
        console.log('❌ Erreur MySQL:', err.message);
        console.log('🔄 Utilisation des données simulées');
    } else {
        console.log('✅ Connecté à MySQL');
        initializeDatabase();
    }
});

function initializeDatabase() {
    // Créer la DB si elle n'existe pas
    db.query('CREATE DATABASE IF NOT EXISTS jobmatchai', (err) => {
        if (err) {
            console.log('❌ Erreur création DB:', err.message);
            return;
        }
        
        db.changeUser({ database: 'jobmatchai' }, (err) => {
            if (err) {
                console.log('❌ Erreur changement DB:', err.message);
                return;
            }
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
            skills_required TEXT,
            salary_range VARCHAR(100),
            job_type VARCHAR(50),
            experience_level VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT TRUE
        )
    `;

    db.query(createTableSQL, (err) => {
        if (err) {
            console.log('❌ Erreur création table:', err.message);
            return;
        }
        console.log('✅ Table job_offers créée');
        insertSampleData();
    });
}

function insertSampleData() {
    const checkSQL = 'SELECT COUNT(*) as count FROM job_offers';
    db.query(checkSQL, (err, results) => {
        if (err) {
            console.log('❌ Erreur vérification données:', err.message);
            return;
        }
        
        if (results[0].count === 0) {
            console.log('📝 Insertion des offres exemple...');
            
            const sampleJobs = [
                {
                    title: "Développeur Fullstack JavaScript",
                    company: "TechCorp",
                    location: "Paris",
                    description: "Nous recherchons un développeur fullstack passionné pour rejoindre notre équipe technique. Vous travaillerez sur des projets innovants avec les dernières technologies web.",
                    requirements: "Minimum 2 ans d'expérience en développement web, maîtrise de JavaScript et React",
                    skills_required: "javascript,react,node.js,mongodb,html,css",
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
                    skills_required: "python,machine learning,sql,pandas,numpy,tensorflow",
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
                    skills_required: "docker,kubernetes,aws,linux,python,bash",
                    salary_range: "48k-58k €",
                    job_type: "CDI",
                    experience_level: "Mid-level"
                }
            ];

            const insertSQL = `
                INSERT INTO job_offers (title, company, location, description, requirements, skills_required, salary_range, job_type, experience_level) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            let inserted = 0;
            sampleJobs.forEach((job) => {
                db.query(insertSQL, [
                    job.title, job.company, job.location, job.description, 
                    job.requirements, job.skills_required, job.salary_range, 
                    job.job_type, job.experience_level
                ], (err) => {
                    if (err) {
                        console.log('❌ Erreur insertion:', err.message);
                    } else {
                        inserted++;
                        if (inserted === sampleJobs.length) {
                            console.log(`✅ ${inserted} offres insérées dans MySQL`);
                        }
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
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    }
});

// 📄 ROUTE 1: Page d'accueil
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 📄 ROUTE 2: Santé du serveur
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'JobMatchAI backend opérationnel',
        timestamp: new Date().toISOString()
    });
});

// 📄 ROUTE 3: Obtenir toutes les offres d'emploi (CORRIGÉE)
app.get('/api/jobs', (req, res) => {
    const sql = 'SELECT * FROM job_offers WHERE is_active = TRUE ORDER BY created_at DESC';
    
    db.query(sql, (err, results) => {
        if (err) {
            console.log('❌ Erreur DB:', err.message);
            return res.json(getSimulatedJobs());
        }
        
        // CORRECTION: Gestion sécurisée des skills
        const jobs = results.map(job => {
            let skills = [];
            
            if (job.skills_required) {
                // Convertir en chaîne si c'est un Buffer
                let skillsString = job.skills_required;
                if (Buffer.isBuffer(skillsString)) {
                    skillsString = skillsString.toString();
                }
                
                // S'assurer que c'est une chaîne
                if (typeof skillsString === 'string') {
                    skills = skillsString.split(',').map(s => s.trim());
                }
            }
            
            return {
                id: job.id,
                title: job.title,
                company: job.company,
                location: job.location,
                description: job.description,
                requirements: job.requirements,
                skills_required: skills,
                salary_range: job.salary_range,
                job_type: job.job_type,
                experience_level: job.experience_level,
                created_at: job.created_at,
                is_active: job.is_active
            };
        });
        
        console.log('📊 Envoi de', jobs.length, 'offres');
        res.json(jobs);
    });
});

function getSimulatedJobs() {
    return [
        {
            id: 1,
            title: "Développeur Fullstack JavaScript",
            company: "TechCorp",
            location: "Paris",
            description: "Données simulées - Développement fullstack",
            skills_required: ["javascript", "react", "node.js"],
            salary_range: "45k-55k €",
            job_type: "CDI",
            experience_level: "Mid-level"
        },
        {
            id: 2,
            title: "Data Scientist Python",
            company: "DataCompany",
            location: "Lyon",
            description: "Données simulées - Data Science",
            skills_required: ["python", "machine learning", "sql"],
            salary_range: "50k-60k €",
            job_type: "CDI", 
            experience_level: "Senior"
        }
    ];
}

// 📄 ROUTE 4: Upload et analyse de CV
app.post('/api/analyze-cv', upload.single('cv'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Aucun fichier uploadé' });
        }

        console.log('📄 CV reçu:', req.file.filename);

        // Simulation de l'analyse de CV
        const simulatedCVText = `
            DÉVELOPPEUR FULLSTACK - AMADOU SOW
            ===================================
            
            EXPÉRIENCE PROFESSIONNELLE:
            - Développeur Fullstack - 3 ans
            - Création d'applications web avec JavaScript, React, Node.js
            - Développement d'APIs REST avec Express.js
            - Gestion de bases de données MongoDB et MySQL
            
            COMPÉTENCES TECHNIQUES:
            • Langages: JavaScript, Python, Java, HTML5, CSS3
            • Frameworks: React, Node.js, Express, Spring Boot
            • Bases de données: MongoDB, MySQL, PostgreSQL
            • Outils: Git, Docker, AWS, Linux, REST APIs
            
            FORMATION:
            - Master en Informatique
            - Licence en Développement Web
        `;

        const userSkills = analyzeCVSkills(simulatedCVText);
        console.log('🔍 Compétences détectées:', Object.keys(userSkills));
        
        // Récupérer les jobs pour le matching
        const sql = 'SELECT * FROM job_offers WHERE is_active = TRUE';
        db.query(sql, (err, allJobs) => {
            if (err || !allJobs || allJobs.length === 0) {
                const matchingJobs = findMatchingJobs(getSimulatedJobs(), userSkills);
                return sendResponse(res, userSkills, matchingJobs);
            }

            // Convertir les skills en tableau
            const jobsWithSkills = allJobs.map(job => {
                let skills = [];
                if (job.skills_required) {
                    let skillsString = job.skills_required;
                    if (Buffer.isBuffer(skillsString)) {
                        skillsString = skillsString.toString();
                    }
                    if (typeof skillsString === 'string') {
                        skills = skillsString.split(',').map(s => s.trim());
                    }
                }
                
                return {
                    ...job,
                    skills_required: skills
                };
            });
            
            const matchingJobs = findMatchingJobs(jobsWithSkills, userSkills);
            sendResponse(res, userSkills, matchingJobs);
        });

    } catch (error) {
        console.error('❌ Erreur analyse CV:', error);
        res.status(500).json({ 
            success: false,
            error: 'Erreur lors de l\'analyse du CV' 
        });
    }
});

// Fonction d'analyse des compétences
function analyzeCVSkills(cvText) {
    const skillsKeywords = {
        'javascript': ['javascript', 'js'],
        'react': ['react', 'react.js'],
        'node.js': ['node', 'node.js', 'express'],
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
                foundSkills[skill] = 0.8;
            }
        });
    });

    return foundSkills;
}

// Fonction de matching des offres
function findMatchingJobs(allJobs, userSkills) {
    const userSkillNames = Object.keys(userSkills);
    
    const matchingJobs = allJobs.map(job => {
        const commonSkills = job.skills_required.filter(skill => 
            userSkillNames.includes(skill)
        );
        
        const matchScore = commonSkills.length > 0 ? Math.round((commonSkills.length / job.skills_required.length) * 100) : 0;
        
        return {
            ...job,
            matchScore: matchScore,
            matchingSkills: commonSkills
        };
    }).filter(job => job.matchScore >= 30)
      .sort((a, b) => b.matchScore - a.matchScore);

    console.log('🎯', matchingJobs.length, 'offres correspondantes');
    return matchingJobs;
}

function sendResponse(res, userSkills, matchingJobs) {
    res.json({
        success: true,
        userSkills: userSkills,
        matchingJobs: matchingJobs,
        totalMatches: matchingJobs.length,
        message: `Analyse terminée! ${matchingJobs.length} offres correspondent à votre profil.`
    });
}

// Gestion des erreurs 404
app.use((req, res) => {
    res.status(404).json({ error: 'Route non trouvée' });
});

// DÉMARRAGE CRITIQUE - Écouter sur toutes les interfaces
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Serveur JobMatchAI démarré sur http://0.0.0.0:${PORT}`);
    console.log(`💻 Test local: http://localhost:${PORT}`);
    console.log(`🌐 Accès externe: http://192.168.40.131:${PORT}`);
    console.log(`📊 API Health: http://localhost:${PORT}/api/health`);
    console.log(`📄 API Jobs: http://localhost:${PORT}/api/jobs`);
    console.log('');
    console.log('✅ Prêt à recevoir des requêtes!');
});
