const fs = require('fs');
const path = require('path');

const writeToJSON = (filename, data) => {
    fs.appendFileSync(path.join(process.cwd(), 'samples', `${filename}.json`), JSON.stringify(data, null, 2));
}

const readFromJSON = (filename) => {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'samples', `${filename}.json`)));
}

module.exports = {
    writeToJSON,
    readFromJSON
}