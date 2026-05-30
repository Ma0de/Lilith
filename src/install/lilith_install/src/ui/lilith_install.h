#ifndef LILITH_INSTALL_H
#define LILITH_INSTALL_H

#include <QWidget>
#include <QStackedWidget>
#include <QLineEdit>
#include <QRadioButton>
#include <QCheckBox>
#include <QComboBox>
#include <QPushButton>
#include <QLabel>
#include <QTextEdit>
#include <QProgressBar>
#include <QButtonGroup>

class LilithInstall : public QWidget
{
    Q_OBJECT

public:
    LilithInstall(QWidget* parent = nullptr);
    ~LilithInstall();

private slots:
    void onBrowsePath();
    void onNext();
    void onPrev();
    void onCancel();
    void onLLMOnlineToggled(bool checked);
    void onLLMLocalToggled(bool checked);
    void onTTSLocalDeployToggled(bool checked);
    void onTTSOnlineToggled(bool checked);
    void onTTSLocalOtherToggled(bool checked);
    void onTTSSkipToggled(bool checked);
    void onLanYesToggled(bool checked);
    void onLanNoToggled(bool checked);
    void onNeedAccountYesToggled(bool checked);
    void onNeedAccountNoToggled(bool checked);
    void onCustomPrivacy();
    void onConfirmCustomPrivacy();
    void onStartInstall();
    void onRollback();
    void onCancelConfirmYes();
    void onCancelConfirmNo();
    void onPauseDownload();
    void onRetryDownload();
    void onConfigProxy();
    void onExportLog();
    void onCopyLog();
    void onUploadLog();
    void onRetryInstall();
    void onLaunchWebUI();
    void onCloseInstaller();
    void onSubmitLog();

private:
    void setupUi();
    int determineNextPage(int currentPage);
    int determinePrevPage(int currentPage);
    void updateSummary();
    void simulateDownload();

    QStackedWidget* stack;

    // Page 1
    QLineEdit* pathEdit;
    QPushButton* browseBtn;

    // Page 2
    QRadioButton* llmOnline;
    QRadioButton* llmLocal;

    // Page 3
    QComboBox* protocolCombo;
    QLineEdit* apiAddrEdit;
    QLineEdit* apiKeyEdit;
    QLineEdit* modelIdEdit;

    // Page 4
    QRadioButton* qualityHigh;
    QRadioButton* qualityNormal;

    // Page 5
    QRadioButton* ttsLocalDeploy;
    QRadioButton* ttsOnline;
    QRadioButton* ttsLocalOther;
    QRadioButton* ttsSkip;

    // Page 6
    QLineEdit* ttsApiAddrEdit;
    QLineEdit* ttsApiKeyEdit;
    QLineEdit* ttsModelIdEdit;
    QComboBox* ttsProtocolCombo;

    // Page 7
    QLabel* perfResultLabel;

    // Page 8
    QLineEdit* portEdit;

    // Page 9
    QRadioButton* lanYes;
    QRadioButton* lanNo;

    // Page 10
    QRadioButton* needAccountYes;
    QRadioButton* needAccountNo;
    QLineEdit* usernameEdit;
    QLineEdit* passwordEdit;
    QLineEdit* confirmPasswordEdit;

    // Page 11
    QCheckBox* desktopShortcut;

    // Page 12
    QCheckBox* autoStart;

    // Page 13
    QRadioButton* privacyAgree;
    QRadioButton* privacyDisagree;
    QPushButton* customPrivacyBtn;

    // Page 14
    QCheckBox* checkLogs;
    QCheckBox* checkTTS;
    QCheckBox* checkErrors;
    QCheckBox* checkHardware;

    // Page 15
    QLabel* summaryLabel;

    // Page 16
    QLabel* downloadStatusLabel;
    QProgressBar* downloadProgress;
    QPushButton* pauseBtn;
    QPushButton* terminateBtn;

    // Page 17
    QLabel* resultTitle;
    QTextEdit* logView;
    QPushButton* exportLogBtn;
    QPushButton* copyLogBtn;
    QPushButton* uploadLogBtn;
    QPushButton* retryBtn;
    QPushButton* launchBtn;
    QPushButton* closeBtn;

    // Page 18
    QTextEdit* submitComment;
    QPushButton* submitLogBtn;

    QPushButton* prevBtn;
    QPushButton* nextBtn;
    QPushButton* cancelBtn;

    int currentPage;
    bool downloadPaused;
    bool downloadTerminated;
};

#endif // LILITH_INSTALL_H