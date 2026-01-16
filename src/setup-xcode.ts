import * as core from "@actions/core";
import axios, { isAxiosError } from "axios";
import { XcodeSelector } from "./xcode-selector";

async function validateSubscription(): Promise<void> {
    const API_URL = `https://agent.api.stepsecurity.io/v1/github/${process.env.GITHUB_REPOSITORY}/actions/subscription`;

    try {
        await axios.get(API_URL, { timeout: 3000 });
    } catch (error) {
        if (isAxiosError(error) && error.response?.status === 403) {
            core.error("Subscription is not valid. Reach out to support@stepsecurity.io");
            process.exit(1);
        } else {
            core.info("Timeout or API not reachable. Continuing to next step.");
        }
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
