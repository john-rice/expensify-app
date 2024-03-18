import {Parser as HtmlParser} from 'htmlparser2';
import type {OnyxEntry} from 'react-native-onyx';
import type {Attachment} from '@components/Attachments/types';
import * as FileUtils from '@libs/fileDownload/FileUtils';
import * as ReportActionsUtils from '@libs/ReportActionsUtils';
import tryResolveUrlFromApiRoot from '@libs/tryResolveUrlFromApiRoot';
import CONST from '@src/CONST';
import type {ReportAction, ReportActions} from '@src/types/onyx';

/** Constructs the initial component state from report actions */
function extractAttachmentsFromReport(parentReportAction?: OnyxEntry<ReportAction>, reportActions?: OnyxEntry<ReportActions>) {
    const actions = [...(parentReportAction ? [parentReportAction] : []), ...ReportActionsUtils.getSortedReportActions(Object.values(reportActions ?? {}))];
    const attachments: Attachment[] = [];

    const htmlParser = new HtmlParser({
        onopentag: (name, attribs) => {
            if (name === 'video') {
                const splittedUrl = attribs[CONST.ATTACHMENT_SOURCE_ATTRIBUTE].split('/');
                attachments.unshift({
                    source: tryResolveUrlFromApiRoot(attribs[CONST.ATTACHMENT_SOURCE_ATTRIBUTE]),
                    isAuthTokenRequired: Boolean(attribs[CONST.ATTACHMENT_SOURCE_ATTRIBUTE]),
                    file: {name: splittedUrl[splittedUrl.length - 1]},
                    duration: Number(attribs[CONST.ATTACHMENT_DURATION_ATTRIBUTE]),
                    isReceipt: false,
                    hasBeenFlagged: false,
                });
                return;
            }

            if (name === 'img' && attribs.src) {
                const expensifySource = attribs[CONST.ATTACHMENT_SOURCE_ATTRIBUTE];
                const source = tryResolveUrlFromApiRoot(expensifySource || attribs.src);
                const fileName = attribs[CONST.ATTACHMENT_ORIGINAL_FILENAME_ATTRIBUTE] || FileUtils.getFileName(`${source}`);

                // By iterating actions in chronological order and prepending each attachment
                // we ensure correct order of attachments even across actions with multiple attachments.
                attachments.unshift({
                    reportActionID: attribs['data-id'],
                    source,
                    isAuthTokenRequired: Boolean(expensifySource),
                    file: {name: fileName},
                    isReceipt: false,
                    hasBeenFlagged: attribs['data-flagged'] === 'true',
                });
            }
        },
    });

    actions.forEach((action, key) => {
        if (!ReportActionsUtils.shouldReportActionBeVisible(action, key) || ReportActionsUtils.isMoneyRequestAction(action)) {
            return;
        }

        const decision = action?.message?.[0].moderationDecision?.decision;
        const hasBeenFlagged = decision === CONST.MODERATION.MODERATOR_DECISION_PENDING_HIDE || decision === CONST.MODERATION.MODERATOR_DECISION_HIDDEN;
        const html = (action?.message?.[0].html ?? '').replace('/>', `data-flagged="${hasBeenFlagged}" data-id="${action.reportActionID}"/>`);
        htmlParser.write(html);
    });
    htmlParser.end();

    return attachments.reverse();
}

export default extractAttachmentsFromReport;
