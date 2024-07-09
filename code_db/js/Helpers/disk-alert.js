const { exec } = require("child_process");
const { sendEmail } = require('../Utils/imc-endpoints.util');

// disk space alert

function sendDiskEmail(textToSend, callback) {
    const mailParams = {
        emails: 'auqib@amygb.ai, shahab@amygb.ai',
        // emailArray: ['shahab@amygb.ai'],
        notificationType: 'disk_space_notification',
        // html: textToSend,
        body: textToSend,
        triggerNow: true,
        subject: `Disk Issue Detected 🔥 | IDP_${process.env.NODE_ENV_LABEL}`
    }

    sendEmail(mailParams, callback);
}

function checkDiskPercent(stdOutData) {
    const disk = process.env.CHECK_DISK_LIST
    if (!disk) {
        console.log("disk not added");
        return
    }
    const disksToCheck = disk.split(", ") // idp azure amygb infra
    // let disksToCheck = ['/dev/disk1s1s1', '/dev/disk1s2']; //shahab local
    const threshHold = 90;
    // let threshHold = 5;
    if (stdOutData && typeof stdOutData === 'string' && stdOutData.length) {
        let emailTextToSend = "";
        stdOutData = stdOutData.split('\n')
        // console.log('stdOutData',stdOutData)
        stdOutData.forEach((eachRow) => {
            if (eachRow && eachRow.length) {
                //console.log('eachRow', eachRow)
                eachRow = eachRow.split(' ')
                if (eachRow && eachRow.length) {
                    let concernedRow = false;
                    if (disksToCheck.includes(eachRow[0])) {
                        concernedRow = true;
                    }
                    if (concernedRow) {
                        for (let i = 1; i < eachRow.length; i++) {
                            const eachWord = eachRow[i];
                            if (eachWord && eachWord.length && eachWord.includes('%')) {
                                const currentUse = eachWord.split('%')[0];
                                const textToDisplay = `Current Use for ${eachRow[0]} is <strong>${currentUse}%</strong>`;
                                //console.log('textToDisplay', textToDisplay)
                                if (parseInt(currentUse, 10) && parseInt(currentUse, 10) >= threshHold) {
                                    emailTextToSend += `${textToDisplay}<br><br>`;
                                }
                            }
                        }
                    }
                }
            }
        })
        if (emailTextToSend && emailTextToSend.length) {
            // console.log('typeof stdOutData',typeof stdOutData)
            stdOutData = stdOutData.join('<br><br>');
            emailTextToSend += `Complete Stats:<br><br>${stdOutData}`;
            sendDiskEmail(emailTextToSend, (err, data) => {
                console.log('sendDiskEmail err,data', err, data)
            })
        }
    }
}

function executeDiskSpaceCheck(callback) {
    exec('df -h', {
    }, (error, stdout) => {
        if (error) {
            callback(error)
        } else {
            checkDiskPercent(stdout)
            // callback(null, parseInt(stdout))
        }
    });
}

executeDiskSpaceCheck()

// setInterval(() => {
//     executeDiskSpaceCheck()
// }, 30 * 60 * 1000)// every 30 mins

// disk space alert end
module.exports = {
    executeDiskSpaceCheck
};
