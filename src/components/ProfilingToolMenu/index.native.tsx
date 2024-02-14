import React, {useCallback, useState} from 'react';
import Config from 'react-native-config';
import DeviceInfo from 'react-native-device-info';
import RNFS from 'react-native-fs';
import {withOnyx} from 'react-native-onyx';
import type {OnyxEntry} from 'react-native-onyx';
import {startProfiling, stopProfiling} from 'react-native-release-profiler';
import Share from 'react-native-share';
import Button from '@components/Button';
import Switch from '@components/Switch';
import TestToolRow from '@components/TestToolRow';
import Text from '@components/Text';
import useThemeStyles from '@hooks/useThemeStyles';
import toggleProfileTool from '@libs/actions/ProfilingTool';
import getPlatform from '@libs/getPlatform';
import Log from '@libs/Log';
import CONFIG from '@src/CONFIG';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import pkg from '../../../package.json';

type ProfilingToolMenuOnyxProps = {
    isProfilingInProgress: OnyxEntry<boolean>;
};

type ProfilingToolMenuProps = ProfilingToolMenuOnyxProps;

function formatBytes(bytes: number, decimals = 2) {
    if (!+bytes) {
        return '0 Bytes';
    }

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

function ProfilingToolMenu({isProfilingInProgress = false}: ProfilingToolMenuProps) {
    const styles = useThemeStyles();
    const [pathIOS, setPathIOS] = useState('');
    const [totalMemory, setTotalMemory] = useState(0);
    const [usedMemory, setUsedMemory] = useState(0);

    // eslint-disable-next-line @lwc/lwc/no-async-await
    const stop = useCallback(async () => {
        const path = await stopProfiling(getPlatform() === CONST.PLATFORM.IOS);
        setPathIOS(path);

        const amountOfTotalMemory = await DeviceInfo.getTotalMemory();
        const amountOfUsedMemory = await DeviceInfo.getUsedMemory();
        setTotalMemory(amountOfTotalMemory);
        setUsedMemory(amountOfUsedMemory);
    }, []);

    const onToggleProfiling = useCallback(() => {
        const shouldProfiling = !isProfilingInProgress;
        if (shouldProfiling) {
            startProfiling();
        } else {
            stop();
        }
        toggleProfileTool();
        return () => {
            stop();
        };
    }, [isProfilingInProgress, stop]);

    const getAppInfo = useCallback(
        () =>
            JSON.stringify({
                appVersion: pkg.version,
                environment: CONFIG.ENVIRONMENT,
                buildVariant: __DEV__ ? 'debug' : 'release',
                platform: getPlatform(),
                totalMemory: formatBytes(totalMemory, 2),
                usedMemory: formatBytes(usedMemory, 2),
            }),
        [totalMemory, usedMemory],
    );

    // eslint-disable-next-line @lwc/lwc/no-async-await
    const onDownloadProfiling = useCallback(async () => {
        const newFileName = `Profile_trace_for_${pkg.version}.json`;
        const newFilePath = `${RNFS.DocumentDirectoryPath}/${newFileName}`;
        const actualPath = `file://${newFilePath}`;

        // Check if the file already exists and delete it if it does
        try {
            const fileExists = await RNFS.exists(newFilePath);
            if (fileExists) {
                await RNFS.unlink(newFilePath);
                Log.hmmm('[ProfilingToolMenu] existing file deleted successfully');
            }
        } catch (error) {
            const typedError = error as Error;
            Log.hmmm('[ProfilingToolMenu] error checking/deleting existing file: ', typedError.message);
        }

        // Copy the file to a new location with the desired filename
        await RNFS.copyFile(pathIOS, newFilePath)
            .then(() => {
                Log.hmmm('[ProfilingToolMenu] file copied successfully');
            })
            .catch((error) => {
                Log.hmmm('[ProfilingToolMenu] error copying file: ', error);
            });

        // Define new filename and path for the app info file
        const infoFileName = `App_Info_${pkg.version}.json`;
        const infoFilePath = `${RNFS.DocumentDirectoryPath}/${infoFileName}`;
        const actualInfoFile = `file://${infoFilePath}`;

        await RNFS.writeFile(infoFilePath, getAppInfo(), 'utf8');

        await Share.open({
            urls: [actualPath, actualInfoFile],
            type: 'application/json',
        });
    }, [getAppInfo, pathIOS]);

    return (
        <>
            <Text
                style={[styles.textLabelSupporting, styles.mb4]}
                numberOfLines={1}
            >
                Release options
            </Text>

            <TestToolRow title="Use Profiling">
                <Switch
                    accessibilityLabel="Use Profiling"
                    isOn={!!isProfilingInProgress}
                    onToggle={onToggleProfiling}
                />
            </TestToolRow>
            <Text style={[styles.textLabelSupporting, styles.mb4]}>{!!pathIOS && `path: ${pathIOS}`}</Text>
            {!!pathIOS && (
                <TestToolRow title="Profile trace">
                    <Button
                        small
                        text="Share"
                        onPress={onDownloadProfiling}
                    />
                </TestToolRow>
            )}
        </>
    );
}

ProfilingToolMenu.displayName = 'ProfilingToolMenu';

export default withOnyx<ProfilingToolMenuProps, ProfilingToolMenuOnyxProps>({
    isProfilingInProgress: {
        key: ONYXKEYS.APP_PROFILING_IN_PROGRESS,
    },
})(ProfilingToolMenu);
