const { spawn } = require('child_process');

const runCliShellCommand = (command, callback) => {
    console.log("COMMAND command", command)
    const child = spawn(command, {
        shell: true,
    });

    child.stderr.on('data', (data) => {
        console.error('runCliShellCommand STDERR:', data.toString());
    });
    child.stdout.on('data', (data) => {
        console.log('runCliShellCommand STDOUT:', data.toString());
    });
    child.on('exit', (exitCode) => {
        console.log(`runCliShellCommand Child vendor exited with code: ${exitCode}`);
        callback();
    });
}
const autoScaleAiServers = ({ numberOfServers = 0, scalarType }, callback) => {
    console.log("autoScaleAiServers")
    if (!process.env[scalarType] || !process.env.AWS_REGION) {
        return callback({ message: "AWS_AUTO_SCALAR_GROUP_NAME and AWS_REGION are not set on env file", statusCode: 422 })
    }
    console.log("autoScaleAiServers run command")

    const command = `aws autoscaling set-desired-capacity --auto-scaling-group-name ${process.env[scalarType]} --desired-capacity ${numberOfServers} --region ${process.env.AWS_REGION}`
    runCliShellCommand(command, callback)
}

const scriptRun = () => {
    console.log("INTERVAL STARTED", process.env.DISALLOW_KVP);
    if (process.env.DISALLOW_KVP !== "DISABLED") {
        autoScaleAiServers({ numberOfServers: 0 }, (e, r) => {
            console.log("DOWN SCALE DONE", e);
        });
        setTimeout(() => {
            // up scale server
            autoScaleAiServers({ numberOfServers: 5 }, (e, r) => {
                console.log("UP SCALE DONE", e);
            });
        }, 1000 * 60)
    } else {
        console.log("INterVAL cleared");
        console.log("INTERVAL CLEARED");
        clearInterval(int);
    }
}
// let int = setInterval(() => {
//     // down  scale servers
//     scriptRun()
// }, 1000 * 60 * 10)
// scriptRun()
module.exports = {
    autoScaleAiServers
};
