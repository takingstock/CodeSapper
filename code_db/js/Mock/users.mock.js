// super admins
module.exports.userArray = [
    {
        email: 'auqib@amygb.ai',
        password: 'P876!MNoji',
        name: 'auqib',
        status: true,
        isDeleted: false,
    },
    {
        email: 'idpadmin@amygb.ai',
        password: 'P876!MNoji',
        name: 'auqib',
        status: true,
        isDeleted: false,
    },
    {
        email: 'shahab+sa@amygb.ai',
        password: 'P876!MNoji',
        name: 'shahab',
        status: true,
        isDeleted: false,
    },
    {
        email: 'abhijeet+sa@amygb.ai',
        password: 'P876!MNoji',
        name: 'abhijeet',
        status: true,
        isDeleted: false,
    },
];
module.exports.enterpriseArray = [
    {
        email: "mark.buckley@requordit.com",
        password: 'P876!mnoji',
        name: 'mark_buckley',
        tenant: 'mark_buckley'
    },
    {
        email: 'sowmya@amygb.ai',
        name: 'sowmya',
        tenant: 'sowmya',
        password: 'P876!MNoji',
    }
]
// enterprise Admin wit same access as enterprise
/* eslint-disable no-unused-vars */
module.exports.enterpriseAdminArray = [
    //
    {
        email: "lennin.mendoza@requordit.com",
        password: 'P123!lknpoi',
        name: 'lennin_mendoza',
        tenant: 'mark_buckley'
    },
    {
        email: "marktest1@amygb.ai",
        password: 'P123!jinm',
        name: 'amygbtest',
        tenant: 'mark_buckley'
    },
    {
        email: "marktest2@amygb.ai",
        password: 'P123!jint',
        name: 'amygb test',
        tenant: 'mark_buckley'
    },
    {
        email: "ana.frias@cloudocr.com",
        password: 'P123!jint',
        name: 'Ana Frias',
        tenant: 'mark_buckley'
    },
    {
        email: "miryam@cloudocr.com",
        password: 'P123!rcodoucl',
        name: 'Miryam Emiliano',
        tenant: 'mark_buckley'
    },
    // amygb users
    {
        email: "rupan.kohli@amygb.ai",
        password: 'P876!MNoji',
        name: 'rupan_kohli',
        tenant: 'sowmya'
    },
    {
        email: "sanib.mohammad@amygb.ai",
        password: 'P876!MNoji',
        name: 'sanib_mohammad',
        tenant: 'sowmya'
    },
    {
        email: 'shashank.dahake@amygb.ai',
        password: 'P876!MNoji',
        name: 'shashank_dahake',
        tenant: 'sowmya'
    },
    {
        email: 'anish.ahmed@amygb.ai',
        password: 'P876!MNoji',
        name: 'anish_ahmed',
        tenant: 'sowmya'
    },
    {
        email: 'pallavi@amygb.ai',
        password: 'P876!MNoji',
        name: 'pallavi',
        tenant: 'sowmya'
    },
    {
        email: 'detha@amygb.ai',
        name: 'detha',
        tenant: 'sowmya',
        password: 'P876!MNoji',
    },
    {
        email: 'rahul.more@amygb.ai',
        name: 'rahul more',
        tenant: 'sowmya',
        password: 'P876!MNoji',
    },
    {
        email: 'amygb@amygb.ai',
        name: 'amygb',
        tenant: 'sowmya',
        password: 'P876!MNoji',
    },
    {
        email: 'abhijeet@amygb.ai',
        name: 'abhijeet',
        tenant: 'sowmya',
        password: 'P876!MNoji',
    },
    {
        email: 'akanksha@amygb.ai',
        name: 'akanksha',
        tenant: 'sowmya',
        password: 'P876!MNoji',
    },
    {
        email: 'bithika@amygb.ai',
        name: 'bithika',
        tenant: 'sowmya',
        password: 'P876!MNoji',
    },
    {
        email: 'farha@amygb.ai',
        name: 'farha',
        tenant: 'sowmya',
        password: 'P876!MNoji',
    },
    {
        email: 'shahab@amygb.ai',
        name: 'shahab',
        tenant: 'sowmya',
        password: 'P876!MNoji',
    },
    {
        email: 'vikram@amygb.ai',
        name: 'vikram',
        tenant: 'sowmya',
        password: 'P876!MNoji',
    },
    {
        email: 'yash@amygb.ai',
        name: 'yash',
        tenant: 'sowmya',
        password: 'P876!MNoji',
    },
    {
        email: 'varun@amygb.ai',
        name: 'varun',
        tenant: 'sowmya',
        password: 'P876!MNoji',
    },
    {
        email: 'auqibx@amygb.ai',
        name: 'auqibx',
        tenant: 'sowmya',
        password: 'P876!MNoji',
    },
    {
        email: 'mayankx@amygb.ai',
        name: 'mayankx',
        tenant: 'sowmya',
        password: 'P876!MNoji',
    },
];
module.exports.TEAMS = [
    // supervisors
    {
        "name": "Thamara Vazquez",
        "tenant": 'mark_buckley',
        "email": "thamara.vazquez@cloudocr.com",
        "role": "SUPERVISOR",
        "teamName": "A",
        "customers": ["279"],
        "password": "PW!123refg",
        "isDeleted": false,
        "isDefault": false
    },

    {
        "name": "Jesus Carlos",
        "tenant": 'mark_buckley',
        "email": "jesus.carlos@cloudocr.com",
        "role": "SUPERVISOR",
        "teamName": "B",
        "customers": ["140", "256"],
        "password": "PW!123refg",
        "isDeleted": false,
        "isDefault": false
    },
    // idexers
    {
        "name": "Damian Melgarejo",
        "tenant": 'mark_buckley',
        "email": "damian.melgarejo@cloudocr.com",
        "supervisorEmailIds": ["thamara.vazquez@cloudocr.com"],
        "role": "INDEXER",
        "teamName": "A",
        "password": "PW!123refg",
        "isDeleted": false,
        "isDefault": false
    },
    {
        "name": "Erendira Chicharo",
        "tenant": 'mark_buckley',
        "email": "erendira.chicharo@cloudocr.com",
        "supervisorEmailIds": ["jesus.carlos@cloudocr.com"],
        "role": "INDEXER",
        "teamName": "B",
        "password": "PW!123refg",
        "isDefault": false
    },
    {
        "name": "DEFAULT SUPERVISOR",
        "email": "default@requordit.com",
        "password": 'P876!mnoji',
        "role": "SUPERVISOR",
        "teamName": "Default Team",
        "customers": [],
        "tenant": 'mark_buckley',
        "isDeleted": false,
        "isDefault": true
    },
    // internal tenant
    // supervisors
    {
        "name": "Thamara Vazquez",
        "tenant": 'sowmya',
        "email": "thamara.vazquez@amygb.ai",
        "role": "SUPERVISOR",
        "teamName": "A",
        "customers": ["279"],
        "password": "PW!123refg",
        "isDeleted": false,
        "isDefault": false
    },

    {
        "name": "Jesus Carlos",
        "tenant": 'sowmya',
        "email": "jesus.carlos@amygb.ai",
        "role": "SUPERVISOR",
        "teamName": "B",
        "customers": ["140", "256"],
        "password": "PW!123refg",
        "isDeleted": false,
        "isDefault": false
    },
    // idexers
    {
        "name": "Damian Melgarejo",
        "tenant": 'sowmya',
        "email": "damian.melgarejo@amygb.ai",
        "supervisorEmailIds": ["thamara.vazquez@amygb.ai"],
        "role": "INDEXER",
        "teamName": "A",
        "password": "PW!123refg",
        "isDeleted": false,
        "isDefault": false
    },
    {
        "name": "Erendira Chicharo",
        "tenant": 'sowmya',
        "email": "erendira.chicharo@amygb.ai",
        "supervisorEmailIds": ["jesus.carlos@amygb.ai"],
        "role": "INDEXER",
        "teamName": "B",
        "password": "PW!123refg",
        "isDefault": false
    },
    {
        "name": "DEFAULT SUPERVISOR",
        "email": "default@amygb.com",
        "password": 'P876!mnoji',
        "role": "SUPERVISOR",
        "teamName": "Default Team",
        "customers": [],
        "tenant": 'sowmya',
        "isDeleted": false,
        "isDefault": true
    }
]
