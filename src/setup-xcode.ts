import * as core from "@actions/core";
import * as fs from "fs";
import axios, { isAxiosError } from "axios";
import { XcodeSelector } from "./xcode-selector";

async function validateSubscription(): Promise<void> {
    const eventPath = process.env.GITHUB_EVENT_PATH;
    let repoPrivate: boolean | undefined;

    if (eventPath && fs.existsSync(eventPath)) {
        const eventData = JSON.parse(fs.readFileSync(eventPath, "utf8"));
        repoPrivate = eventData?.repository?.private;
    }

    const upstream = "maxim-lobanov/setup-xcode";
    const action = process.env.GITHUB_ACTION_REPOSITORY;
    const docsUrl = "https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions";

    core.info("");
    core.info("\u001b[1;36mStepSecurity Maintained Action\u001b[0m");
    core.info(`Secure drop-in replacement for ${upstream}`);
    if (repoPrivate === false) core.info("\u001b[32m\u2713 Free for public repositories\u001b[0m");
    core.info(`\u001b[36mLearn more:\u001b[0m ${docsUrl}`);
    core.info("");

    if (repoPrivate === false) return;

    const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";
    const body: Record<string, string> = { action: action || "" };
    if (serverUrl !== "https://github.com") body.ghes_server = serverUrl;
    try {
        await axios.post(
            `https://agent.api.stepsecurity.io/v1/github/${process.env.GITHUB_REPOSITORY}/actions/maintained-actions-subscription`,
            body,
            { timeout: 3000 },
        );
    } catch (error) {
        if (isAxiosError(error) && error.response?.status === 403) {
            core.error(
                `\u001b[1;31mThis action requires a StepSecurity subscription for private repositories.\u001b[0m`,
            );
            core.error(`\u001b[31mLearn how to enable a subscription: ${docsUrl}\u001b[0m`);
            process.exit(1);
        }
        core.info("Timeout or API not reachable. Continuing to next step.");
    }
}

async function run(): Promise<void> {
    try {
        await validateSubscription();

        if (process.platform !== "darwin") {
            throw new Error(
                `This task is intended only for macOS platform. It can't be run on '${process.platform}' platform`,
            );
        }

        const versionSpec = core.getInput("xcode-version", { required: false });
        core.info(`Switching Xcode to version '${versionSpec}'...`);

        const selector = new XcodeSelector();
        if (core.isDebug()) {
            core.startGroup("Available Xcode versions:");
            core.debug(JSON.stringify(selector.getAllVersions(), null, 2));
            core.endGroup();
        }
        const targetVersion = selector.findVersion(versionSpec);

        if (!targetVersion) {
            console.log("Available versions:");
            console.table(selector.getAllVersions());
            throw new Error(
                `Could not find Xcode version that satisfied version spec: '${versionSpec}'`,
            );
        }

        core.debug(
            `Xcode ${targetVersion.version} (${targetVersion.buildNumber}) (${targetVersion.path}) will be set`,
        );
        selector.setVersion(targetVersion);
        core.info(`Xcode is set to ${targetVersion.version} (${targetVersion.buildNumber})`);

        core.setOutput("version", targetVersion.version);
        core.setOutput("path", targetVersion.path);
    } catch (error: unknown) {
        core.setFailed((error as Error).message);
    }
}

run();
