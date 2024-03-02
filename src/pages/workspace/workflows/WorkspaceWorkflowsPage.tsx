import {useIsFocused} from '@react-navigation/native';
import type {StackScreenProps} from '@react-navigation/stack';
import React, {useCallback, useEffect, useMemo} from 'react';
import {View} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import {withOnyx} from 'react-native-onyx';
import * as Illustrations from '@components/Icon/Illustrations';
import MenuItem from '@components/MenuItem';
import Section from '@components/Section';
import Text from '@components/Text';
import withCurrentUserPersonalDetails from '@components/withCurrentUserPersonalDetails';
import type {WithCurrentUserPersonalDetailsProps} from '@components/withCurrentUserPersonalDetails';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import usePrevious from '@hooks/usePrevious';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
import BankAccount from '@libs/models/BankAccount';
import Navigation from '@libs/Navigation/Navigation';
import Permissions from '@libs/Permissions';
import * as PersonalDetailsUtils from '@libs/PersonalDetailsUtils';
import * as PolicyUtils from '@libs/PolicyUtils';
import type {CentralPaneNavigatorParamList} from '@navigation/types';
import type {WithPolicyProps} from '@pages/workspace/withPolicy';
import withPolicy from '@pages/workspace/withPolicy';
import WorkspacePageWithSections from '@pages/workspace/WorkspacePageWithSections';
import * as Policy from '@userActions/Policy';
import {navigateToBankAccountRoute} from '@userActions/ReimbursementAccount';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type SCREENS from '@src/SCREENS';
import type {Beta, ReimbursementAccount} from '@src/types/onyx';
import ToggleSettingOptionRow from './ToggleSettingsOptionRow';
import type {ToggleSettingOptionRowProps} from './ToggleSettingsOptionRow';
import {getAutoReportingFrequencyDisplayNames} from './WorkspaceAutoReportingFrequencyPage';
import type {AutoReportingFrequencyKey} from './WorkspaceAutoReportingFrequencyPage';

type WorkspaceWorkflowsPageOnyxProps = {
    /** Beta features list */
    betas: OnyxEntry<Beta[]>;
    /** Reimbursement account details */
    reimbursementAccount: OnyxEntry<ReimbursementAccount>;
};
type WorkspaceWorkflowsPageProps = WithCurrentUserPersonalDetailsProps &
    WithPolicyProps &
    WorkspaceWorkflowsPageOnyxProps &
    StackScreenProps<CentralPaneNavigatorParamList, typeof SCREENS.WORKSPACE.WORKFLOWS>;

function WorkspaceWorkflowsPage({policy, betas, route, reimbursementAccount, currentUserPersonalDetails}: WorkspaceWorkflowsPageProps) {
    const {translate, preferredLocale} = useLocalize();
    const styles = useThemeStyles();
    const {isSmallScreenWidth} = useWindowDimensions();
    const {isOffline} = useNetwork();

    const isFocused = useIsFocused();
    const prevIsFocused = usePrevious(isFocused);

    const policyApproverEmail = policy?.approver;
    const policyApproverName = useMemo(() => PersonalDetailsUtils.getPersonalDetailByEmail(policyApproverEmail ?? '')?.displayName ?? policyApproverEmail, [policyApproverEmail]);
    const containerStyle = useMemo(() => [styles.ph8, styles.mhn8, styles.ml11, styles.pv3, styles.pr0, styles.pl4, styles.mr0, styles.widthAuto, styles.mt4], [styles]);
    const canUseDelayedSubmission = Permissions.canUseWorkflowsDelayedSubmission(betas);

    const onPressAutoReportingFrequency = useCallback(() => Navigation.navigate(ROUTES.WORKSPACE_WORKFLOWS_AUTOREPORTING_FREQUENCY.getRoute(policy?.id ?? '')), [policy?.id]);

    const authorizedPayerAccountID = policy?.authorizedPayerAccountID ?? policy?.ownerAccountID ?? 0;

    const displayNameForAuthorizedPayer = PersonalDetailsUtils.getPersonalDetailsByIDs([authorizedPayerAccountID], currentUserPersonalDetails.accountID)[0]?.displayName;

    const fetchData = useCallback(() => {
        if (!policy?.id) {
            return;
        }
        Policy.openWorkspaceReimburseView(policy?.id);
    }, [policy]);

    useEffect(() => {
        if (isOffline || !isFocused || prevIsFocused === isFocused) {
            return;
        }
        fetchData();
    }, [isFocused, isOffline, prevIsFocused, fetchData]);

    const activeRoute = Navigation.getActiveRouteWithoutParams();

    const items: ToggleSettingOptionRowProps[] = useMemo(() => {
        const {accountNumber, state, bankName} = reimbursementAccount?.achData ?? {};
        const hasVBA = state === BankAccount.STATE.OPEN;
        const bankDisplayName = bankName ? `${bankName} ${accountNumber ? `${accountNumber.slice(-5)}` : ''}` : '';
        return [
            ...(canUseDelayedSubmission
                ? [
                      {
                          icon: Illustrations.ReceiptEnvelope,
                          title: translate('workflowsPage.delaySubmissionTitle'),
                          subtitle: translate('workflowsPage.delaySubmissionDescription'),
                          onToggle: (isEnabled: boolean) => {
                              Policy.setWorkspaceAutoReporting(route.params.policyID, isEnabled);
                          },
                          subMenuItems: (
                              <MenuItem
                                  title={translate('workflowsPage.submissionFrequency')}
                                  titleStyle={styles.textLabelSupportingNormal}
                                  descriptionTextStyle={styles.textNormalThemeText}
                                  onPress={onPressAutoReportingFrequency}
                                  description={
                                      getAutoReportingFrequencyDisplayNames(preferredLocale)[
                                          (policy?.autoReportingFrequency as AutoReportingFrequencyKey) ?? CONST.POLICY.AUTO_REPORTING_FREQUENCIES.WEEKLY
                                      ]
                                  }
                                  shouldShowRightIcon
                                  wrapperStyle={containerStyle}
                                  hoverAndPressStyle={[styles.mr0, styles.br2]}
                              />
                          ),
                          isActive: policy?.harvesting?.enabled ?? false,
                          pendingAction: policy?.pendingFields?.isAutoApprovalEnabled,
                      },
                  ]
                : []),
            {
                icon: Illustrations.Approval,
                title: translate('workflowsPage.addApprovalsTitle'),
                subtitle: translate('workflowsPage.addApprovalsDescription'),
                onToggle: (isEnabled: boolean) => {
                    Policy.setWorkspaceApprovalMode(route.params.policyID, policy?.owner ?? '', isEnabled ? CONST.POLICY.APPROVAL_MODE.BASIC : CONST.POLICY.APPROVAL_MODE.OPTIONAL);
                },
                subMenuItems: (
                    <MenuItem
                        title={translate('workflowsPage.approver')}
                        titleStyle={styles.textLabelSupportingNormal}
                        descriptionTextStyle={styles.textNormalThemeText}
                        description={policyApproverName ?? ''}
                        onPress={() => Navigation.navigate(ROUTES.WORKSPACE_WORKFLOWS_APPROVER.getRoute(route.params.policyID))}
                        shouldShowRightIcon
                        wrapperStyle={containerStyle}
                        hoverAndPressStyle={[styles.mr0, styles.br2]}
                    />
                ),
                isActive: policy?.isAutoApprovalEnabled ?? false,
                pendingAction: policy?.pendingFields?.approvalMode,
            },
            {
                icon: Illustrations.WalletAlt,
                title: translate('workflowsPage.makeOrTrackPaymentsTitle'),
                subtitle: translate('workflowsPage.makeOrTrackPaymentsDescription'),
                onToggle: () => {
                    const isAutoReimbursable = policy?.reimbursementChoice === CONST.POLICY.REIMBURSEMENT_CHOICES.REIMBURSEMENT_YES;
                    const newReimbursementChoice = isAutoReimbursable ? CONST.POLICY.REIMBURSEMENT_CHOICES.REIMBURSEMENT_NO : CONST.POLICY.REIMBURSEMENT_CHOICES.REIMBURSEMENT_YES;
                    Policy.setWorkspaceReimbursement(route.params.policyID, newReimbursementChoice);
                },
                subMenuItems: (
                    <>
                        <MenuItem
                            titleStyle={styles.textLabelSupportingNormal}
                            descriptionTextStyle={styles.textNormalThemeText}
                            title={hasVBA ? translate('common.bankAccount') : undefined}
                            description={state !== BankAccount.STATE.OPEN ? translate('workflowsPage.connectBankAccount') : bankDisplayName}
                            onPress={() => navigateToBankAccountRoute(route.params.policyID, activeRoute)}
                            shouldShowRightIcon
                            wrapperStyle={containerStyle}
                            hoverAndPressStyle={[styles.mr0, styles.br2]}
                        />
                        {hasVBA && (
                            <MenuItem
                                titleStyle={styles.textLabelSupportingNormal}
                                descriptionTextStyle={styles.textNormalThemeText}
                                title={translate('workflowsPage.authorizedPayer')}
                                description={displayNameForAuthorizedPayer}
                                onPress={() => Navigation.navigate(ROUTES.WORKSPACE_WORKFLOWS_PAYER.getRoute(route.params.policyID))}
                                shouldShowRightIcon
                                wrapperStyle={containerStyle}
                                hoverAndPressStyle={[styles.mr0, styles.br2]}
                            />
                        )}
                    </>
                ),
                isEndOptionRow: true,
                isActive: policy?.reimbursementChoice === CONST.POLICY.REIMBURSEMENT_CHOICES.REIMBURSEMENT_YES,
                pendingAction: policy?.pendingFields?.reimbursementChoice,
            },
        ];
    }, [
        policy,
        route.params.policyID,
        styles,
        translate,
        policyApproverName,
        containerStyle,
        onPressAutoReportingFrequency,
        preferredLocale,
        canUseDelayedSubmission,
        activeRoute,
        reimbursementAccount?.achData,
        displayNameForAuthorizedPayer,
    ]);

    const renderOptionItem = (item: ToggleSettingOptionRowProps, index: number) => (
        <View
            style={styles.mt7}
            key={`toggleSettingOptionRow-${index}`}
        >
            <ToggleSettingOptionRow
                icon={item.icon}
                title={item.title}
                subtitle={item.subtitle}
                onToggle={item.onToggle}
                subMenuItems={item.subMenuItems}
                isActive={item.isActive}
                pendingAction={item.pendingAction}
            />
        </View>
    );

    const isPaidGroupPolicy = PolicyUtils.isPaidGroupPolicy(policy);
    const isPolicyAdmin = PolicyUtils.isPolicyAdmin(policy);

    return (
        <WorkspacePageWithSections
            headerText={translate('workspace.common.workflows')}
            icon={Illustrations.Workflows}
            route={route}
            guidesCallTaskID={CONST.GUIDES_CALL_TASK_IDS.WORKSPACE_WORKFLOWS}
            shouldShowOfflineIndicatorInWideScreen
            shouldShowNotFoundPage={!isPaidGroupPolicy || !isPolicyAdmin}
            shouldUseScrollView
            shouldSkipVBBACall
        >
            <View style={[styles.mt3, styles.textStrong, isSmallScreenWidth ? styles.workspaceSectionMobile : styles.workspaceSection]}>
                <Section
                    title={translate('workflowsPage.workflowTitle')}
                    titleStyles={styles.textStrong}
                    containerStyles={isSmallScreenWidth ? styles.p5 : styles.p8}
                >
                    <View>
                        <Text style={[styles.mt3, styles.textSupporting]}>{translate('workflowsPage.workflowDescription')}</Text>
                        {items.map((item, index) => renderOptionItem(item, index))}
                    </View>
                </Section>
            </View>
        </WorkspacePageWithSections>
    );
}

WorkspaceWorkflowsPage.displayName = 'WorkspaceWorkflowsPage';

export default withCurrentUserPersonalDetails(
    withPolicy(
        withOnyx<WorkspaceWorkflowsPageProps, WorkspaceWorkflowsPageOnyxProps>({
            betas: {
                key: ONYXKEYS.BETAS,
            },
            // @ts-expect-error: ONYXKEYS.REIMBURSEMENT_ACCOUNT is conflicting with ONYXKEYS.FORMS.REIMBURSEMENT_ACCOUNT_FORM
            reimbursementAccount: {
                key: ONYXKEYS.REIMBURSEMENT_ACCOUNT,
            },
        })(WorkspaceWorkflowsPage),
    ),
);
