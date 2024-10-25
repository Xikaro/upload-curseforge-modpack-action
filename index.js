const core = require('@actions/core');
const fs = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');

(async () => {
    try {
        const apiToken = core.getInput('api-token');
        const projectID = Number.parseInt(core.getInput('project-id'));
        const modpackPath = core.getInput('modpack-path');
        const modpackServerPath = core.getInput('modpack-server-path');
        const changelogPath = core.getInput('changelog-path');
        const changelogFormat = core.getInput('changelog-format');
        const gameVersion = core.getInput('game-version');
        const displayName = core.getInput('display-name');
        const serverDisplayName = core.getInput('server-display-name');
        let releaseType = core.getInput('release-type');

        if (releaseType) {
            releaseType = releaseType.toLowerCase();
        }

        core.setSecret(apiToken);

        console.log(`Project ID set to '${projectID}'`);
        console.log(`Modpack path set to '${modpackPath}'`);
        console.log(`Modpack server path set to '${modpackServerPath}'`);
        console.log(`Changelog path set to '${changelogPath}'`);

        let gameVersionID;
        if (gameVersion) {
            core.startGroup('Fetching game versions');
            const versions = await getVersions(apiToken);
            const gameVersionObject = versions.find(e => e.name === gameVersion || e.slug === gameVersion);
            if (gameVersionObject) {
                gameVersionID = gameVersionObject.id;
            }
            core.endGroup();
        }

        const changelog = fs.readFileSync(changelogPath, 'utf-8');

        core.startGroup('Upload Modpack');

        const fileID = await upload(projectID, apiToken, modpackPath, {
            changelog: changelogPath,
            changelogType: changelogFormat,
            displayName: displayName,
            gameVersions: gameVersionID ? [gameVersionID] : [],
            releaseType: releaseType
        });

        core.endGroup();
        core.startGroup('Upload Modpack Server');

        if (modpackServerPath) {
            await upload(projectID, apiToken, modpackServerPath, {
                changelog: changelogPath,
                changelogType: changelogFormat,
                displayName: serverDisplayName,
                parentFileID: fileID,
                releaseType: releaseType,
                isServerPack: true
            });
        }

        core.endGroup();

        core.setOutput('id', fileID);
    } catch (error) {
        core.setFailed(error.message);
    }
})();

async function upload(projectID, apiToken, file, metadata) {
    const form = new FormData();
    form.append('metadata', JSON.stringify(metadata));
    form.append('file', fs.createReadStream(file));

    const res = await fetch(`https://minecraft.curseforge.com/api/projects/${projectID}/upload-file`, { method: 'POST', body: form, headers: { 'X-Api-Token': apiToken } });

    if (!res.ok) {
        core.setFailed(`Uploading file returned status code ${res.status}`);
        process.exit(1702);
    }

    const response = await res.json();

    if (!response.id) {
        core.setFailed('Uploading file did not return a file ID');
        process.exit(1703);
    }

    return response.id;
}

async function getVersions(apiToken) {
    const res = await fetch('https://minecraft.curseforge.com/api/game/versions', { method: 'GET', headers: { 'X-Api-Token': apiToken } });

    if (!res.ok) {
        core.setFailed(`Getting versions returned status code ${res.status}`);
        process.exit(1704);
    }

    return await res.json();
}
