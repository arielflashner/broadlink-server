
let broadlink = require('broadlinkjs');
let fs = require('fs');

const http = require('http');
const port = 3000;

const requestHandler = (request, response) => {
    response.setHeader('Content-Type', 'application/json');
    var timer;
    var url = request.url.split('/');
    var action = url[1];
    var device = url[2];
    var commandName = url[3];

    var getTemp = function (temp) {
        response.end(JSON.stringify({ temperature: temp }));
    };

    var rawData = function (data) {
        var commandData = Buffer.from(data).toString('hex');
        var ret = function (err) {
            if (timer)
                clearInterval(timer);
            if (err) {
                console.log(err);
                response.end(JSON.stringify({ error: 'Failed to write file' }));
                return;

            }
            console.log("Command " + commandName + " saved");
            response.end(JSON.stringify({ message: 'success' }));
        };
        fs.writeFile(commandName, commandData, ret);
    };

    if (!device) {
        response.end(JSON.stringify({ error: 'No device specified' }));
        return;
    }

    if (!action) {
        response.end(JSON.stringify({ error: 'No action specified' }));
        return;
    }
    console.log('action: ' + action + ', device: ' + device);

    var mac;
    try {
        mac = Buffer.from(device, 'hex');
    }
    catch (err) {
        response.end(JSON.stringify({ error: 'Failed to parse requested device' }));
        return;
    }
    var dev = b.devices[mac];
    if (!dev) {
        response.end(JSON.stringify({ error: 'Device not found' }));
        return;
    }

    if (action == 'temperature') {
        dev.on("temperature", getTemp);
        request.on('end', function () {
            dev.removeListener("temperature", getTemp);
        });
        dev.checkTemperature();
    } else if (action == 'learn') {
        if (!commandName) {
            response.end(JSON.stringify({ error: 'No command name specified' }));
            return;
        }

        dev.on("rawData", rawData);
        timer = setInterval(function () {
            console.log("checking for data from device " + device);
            dev.checkData();
        }, 500);

        request.on('end', function () {
            dev.removeListener("rawData", rawData);
            if (timer)
                clearInterval(timer);
        });
        dev.enterLearning();
    } else if (action == 'sendcommand') {
        if (!commandName) {
            response.end(JSON.stringify({ error: 'No command name specified' }));
            return;
        }

        fs.readFile(commandName, 'utf8', function (err, data) {
            if (err) {
                console.log(err);
                response.end(JSON.stringify({ error: 'Failed to read command file' }));
                return;
            }
            var commandData = Buffer.from(data, 'hex');
            dev.sendData(commandData);
            console.log('Command ' + commandName + ' sent to device ' + device);
            response.end(JSON.stringify({ message: 'success' }));
        });
    }

}

const server = http.createServer(requestHandler)

server.listen(port, (err) => {
    if (err) {
        return console.log('something bad happened', err)
    }

    console.log(`server is listening on ${port}`)
})

var b = new broadlink();
b.on("deviceReady", (dev) => {
    console.log("Found device with mac: " + dev.mac.toString('hex'));
});

b.discover();
