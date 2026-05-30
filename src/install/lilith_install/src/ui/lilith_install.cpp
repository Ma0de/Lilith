#include "lilith_install.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QFileDialog>
#include <QMessageBox>
#include <QGroupBox>
#include <QScrollArea>
#include <QFile>
#include <QTextStream>
#include <QFont>

LilithInstall::LilithInstall(QWidget* parent)
    : QWidget(parent), currentPage(0), downloadPaused(false), downloadTerminated(false)
{
    setupUi();
}

LilithInstall::~LilithInstall()
{
}

void LilithInstall::setupUi()
{
    QVBoxLayout* mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(40, 30, 40, 15);
    mainLayout->setSpacing(0);

    stack = new QStackedWidget;
    mainLayout->addWidget(stack);

    // Page 0 - Install path
    {
        QWidget* page = new QWidget;
        QVBoxLayout* layout = new QVBoxLayout(page);
        layout->setContentsMargins(20, 20, 20, 20);
        layout->setSpacing(15);
        QLabel* label = new QLabel("请选择你的安装路径：");
        QFont titleFont = label->font();
        titleFont.setPointSize(14);
        titleFont.setBold(true);
        label->setFont(titleFont);
        label->setStyleSheet("color: #1a1a2e;");
        layout->addWidget(label);
        QHBoxLayout* hl = new QHBoxLayout;
        hl->setSpacing(10);
        pathEdit = new QLineEdit;
        pathEdit->setPlaceholderText("C:/Program Files/Lilith");
        pathEdit->setMinimumHeight(32);
        hl->addWidget(pathEdit);
        browseBtn = new QPushButton("浏览");
        browseBtn->setMinimumHeight(32);
        browseBtn->setFixedWidth(80);
        hl->addWidget(browseBtn);
        layout->addLayout(hl);
        layout->addStretch();
        connect(browseBtn, &QPushButton::clicked, this, &LilithInstall::onBrowsePath);
        stack->addWidget(page);
    }

    // Page 1 - LLM location
    {
        QWidget* page = new QWidget;
        QVBoxLayout* layout = new QVBoxLayout(page);
        layout->setContentsMargins(20, 20, 20, 20);
        layout->setSpacing(15);
        QLabel* label = new QLabel("你的LLM服务在哪？");
        QFont titleFont = label->font();
        titleFont.setPointSize(14);
        titleFont.setBold(true);
        label->setFont(titleFont);
        label->setStyleSheet("color: #1a1a2e;");
        layout->addWidget(label);
        llmOnline = new QRadioButton("在线");
        llmLocal = new QRadioButton("本地");
        QFont radioFont = llmOnline->font();
        radioFont.setPointSize(12);
        llmOnline->setFont(radioFont);
        llmLocal->setFont(radioFont);
        layout->addWidget(llmOnline);
        layout->addWidget(llmLocal);
        layout->addStretch();
        connect(llmOnline, &QRadioButton::toggled, this, &LilithInstall::onLLMOnlineToggled);
        connect(llmLocal, &QRadioButton::toggled, this, &LilithInstall::onLLMLocalToggled);
        stack->addWidget(page);
    }

    // Page 2 - LLM config
    {
        QWidget* page = new QWidget;
        QVBoxLayout* layout = new QVBoxLayout(page);
        layout->setContentsMargins(20, 20, 20, 20);
        layout->setSpacing(12);
        QLabel* label = new QLabel("配置你的LLM服务商信息");
        QFont titleFont = label->font();
        titleFont.setPointSize(14);
        titleFont.setBold(true);
        label->setFont(titleFont);
        label->setStyleSheet("color: #1a1a2e;");
        layout->addWidget(label);
        QLabel* subtitle = new QLabel("我们将会尝试使用以下信息发送一条验证信息以确认你填写的信息是正确的");
        QFont subFont = subtitle->font();
        subFont.setPointSize(10);
        subtitle->setFont(subFont);
        subtitle->setStyleSheet("color: #6c757d; margin-bottom: 8px;");
        subtitle->setWordWrap(true);
        layout->addWidget(subtitle);

        QWidget* formContainer = new QWidget;
        QVBoxLayout* formLayout = new QVBoxLayout(formContainer);
        formLayout->setSpacing(10);

        QHBoxLayout* hl1 = new QHBoxLayout;
        QLabel* lbl1 = new QLabel("服务商API协议：");
        lbl1->setFixedWidth(120);
        lbl1->setStyleSheet("color: #495057; font-size: 12px;");
        hl1->addWidget(lbl1);
        protocolCombo = new QComboBox;
        protocolCombo->addItems({ "OpenAI", "Anthropic" });
        protocolCombo->setMinimumHeight(30);
        hl1->addWidget(protocolCombo);
        hl1->addStretch();
        formLayout->addLayout(hl1);

        QHBoxLayout* hl2 = new QHBoxLayout;
        QLabel* lbl2 = new QLabel("API 地址：");
        lbl2->setFixedWidth(120);
        lbl2->setStyleSheet("color: #495057; font-size: 12px;");
        hl2->addWidget(lbl2);
        apiAddrEdit = new QLineEdit;
        apiAddrEdit->setMinimumHeight(30);
        hl2->addWidget(apiAddrEdit);
        formLayout->addLayout(hl2);

        QHBoxLayout* hl3 = new QHBoxLayout;
        QLabel* lbl3 = new QLabel("API 密钥：");
        lbl3->setFixedWidth(120);
        lbl3->setStyleSheet("color: #495057; font-size: 12px;");
        hl3->addWidget(lbl3);
        apiKeyEdit = new QLineEdit;
        apiKeyEdit->setEchoMode(QLineEdit::Password);
        apiKeyEdit->setMinimumHeight(30);
        hl3->addWidget(apiKeyEdit);
        formLayout->addLayout(hl3);

        QHBoxLayout* hl4 = new QHBoxLayout;
        QLabel* lbl4 = new QLabel("使用的模型ID：");
        lbl4->setFixedWidth(120);
        lbl4->setStyleSheet("color: #495057; font-size: 12px;");
        hl4->addWidget(lbl4);
        modelIdEdit = new QLineEdit;
        modelIdEdit->setMinimumHeight(30);
        hl4->addWidget(modelIdEdit);
        formLayout->addLayout(hl4);

        layout->addWidget(formContainer);
        layout->addStretch();
        stack->addWidget(page);
    }

    // Page 3 - Quality
    {
        QWidget* page = new QWidget;
        QVBoxLayout* layout = new QVBoxLayout(page);
        layout->setContentsMargins(20, 20, 20, 20);
        layout->setSpacing(15);
        QLabel* label = new QLabel("你希望莉莉丝的对话质量？");
        QFont titleFont = label->font();
        titleFont.setPointSize(14);
        titleFont.setBold(true);
        label->setFont(titleFont);
        label->setStyleSheet("color: #1a1a2e;");
        layout->addWidget(label);
        QLabel* tip = new QLabel("高质量需要更强的大模型（如Deepseek-V4-Flash，ChatGPT-4o），消耗的Token也更多，而普通适用于中模型（如GLM-4-Flash），消耗Token更少\n\nTips：消耗Token的差距通常是因为中模型无法理解强约束提示词，所以减少了提示词导致的");
        tip->setWordWrap(true);
        QFont tipFont = tip->font();
        tipFont.setPointSize(10);
        tip->setFont(tipFont);
        tip->setStyleSheet("color: #6c757d; line-height: 1.6;");
        layout->addWidget(tip);
        qualityHigh = new QRadioButton("高质量");
        qualityNormal = new QRadioButton("普通");
        QFont radioFont = qualityHigh->font();
        radioFont.setPointSize(12);
        qualityHigh->setFont(radioFont);
        qualityNormal->setFont(radioFont);
        layout->addWidget(qualityHigh);
        layout->addWidget(qualityNormal);
        layout->addStretch();
        stack->addWidget(page);
    }

    // Page 4 - TTS provider
    {
        QWidget* page = new QWidget;
        QVBoxLayout* layout = new QVBoxLayout(page);
        layout->setContentsMargins(20, 20, 20, 20);
        layout->setSpacing(12);
        QLabel* label = new QLabel("配置莉莉丝的声音");
        QFont titleFont = label->font();
        titleFont.setPointSize(14);
        titleFont.setBold(true);
        label->setFont(titleFont);
        label->setStyleSheet("color: #1a1a2e;");
        layout->addWidget(label);
        QLabel* subtitle = new QLabel("配置提供声音的TTS服务商");
        QFont subFont = subtitle->font();
        subFont.setPointSize(11);
        subtitle->setFont(subFont);
        subtitle->setStyleSheet("color: #495057;");
        subtitle->setWordWrap(true);
        layout->addWidget(subtitle);
        QLabel* tip = new QLabel("我们推荐你试试看本地部署Qwen3-TTS-12Hz-1.7B-Base，既无需承担API费用又高效好用\nTTS服务商：Qwen3-TTS（固定）");
        tip->setWordWrap(true);
        QFont tipFont = tip->font();
        tipFont.setPointSize(10);
        tip->setFont(tipFont);
        tip->setStyleSheet("color: #6c757d; line-height: 1.5;");
        layout->addWidget(tip);
        ttsLocalDeploy = new QRadioButton("本地部署Qwen3-TTS-12Hz-1.7B-Base（最推荐）");
        ttsOnline = new QRadioButton("在线Qwen3-TTS（推荐）");
        ttsLocalOther = new QRadioButton("本地（如果你有更好的选择）");
        ttsSkip = new QRadioButton("日后再谈");
        QFont radioFont = ttsLocalDeploy->font();
        radioFont.setPointSize(11);
        ttsLocalDeploy->setFont(radioFont);
        ttsOnline->setFont(radioFont);
        ttsLocalOther->setFont(radioFont);
        ttsSkip->setFont(radioFont);
        layout->addWidget(ttsLocalDeploy);
        layout->addWidget(ttsOnline);
        layout->addWidget(ttsLocalOther);
        layout->addWidget(ttsSkip);
        layout->addStretch();
        connect(ttsLocalDeploy, &QRadioButton::toggled, this, &LilithInstall::onTTSLocalDeployToggled);
        connect(ttsOnline, &QRadioButton::toggled, this, &LilithInstall::onTTSOnlineToggled);
        connect(ttsLocalOther, &QRadioButton::toggled, this, &LilithInstall::onTTSLocalOtherToggled);
        connect(ttsSkip, &QRadioButton::toggled, this, &LilithInstall::onTTSSkipToggled);
        stack->addWidget(page);
    }

    // Page 5 - TTS config
    {
        QWidget* page = new QWidget;
        QVBoxLayout* layout = new QVBoxLayout(page);
        layout->setContentsMargins(20, 20, 20, 20);
        layout->setSpacing(12);
        QLabel* label = new QLabel("详细TTS配置");
        QFont titleFont = label->font();
        titleFont.setPointSize(14);
        titleFont.setBold(true);
        label->setFont(titleFont);
        label->setStyleSheet("color: #1a1a2e;");
        layout->addWidget(label);

        QWidget* formContainer = new QWidget;
        QVBoxLayout* formLayout = new QVBoxLayout(formContainer);
        formLayout->setSpacing(10);

        QHBoxLayout* hl1 = new QHBoxLayout;
        QLabel* lbl1 = new QLabel("TTS API 地址：");
        lbl1->setFixedWidth(120);
        lbl1->setStyleSheet("color: #495057; font-size: 12px;");
        hl1->addWidget(lbl1);
        ttsApiAddrEdit = new QLineEdit;
        ttsApiAddrEdit->setMinimumHeight(30);
        hl1->addWidget(ttsApiAddrEdit);
        formLayout->addLayout(hl1);

        QHBoxLayout* hl2 = new QHBoxLayout;
        QLabel* lbl2 = new QLabel("TTS API 密钥：");
        lbl2->setFixedWidth(120);
        lbl2->setStyleSheet("color: #495057; font-size: 12px;");
        hl2->addWidget(lbl2);
        ttsApiKeyEdit = new QLineEdit;
        ttsApiKeyEdit->setEchoMode(QLineEdit::Password);
        ttsApiKeyEdit->setMinimumHeight(30);
        hl2->addWidget(ttsApiKeyEdit);
        formLayout->addLayout(hl2);

        QHBoxLayout* hl3 = new QHBoxLayout;
        QLabel* lbl3 = new QLabel("TTS 模型ID：");
        lbl3->setFixedWidth(120);
        lbl3->setStyleSheet("color: #495057; font-size: 12px;");
        hl3->addWidget(lbl3);
        ttsModelIdEdit = new QLineEdit;
        ttsModelIdEdit->setMinimumHeight(30);
        hl3->addWidget(ttsModelIdEdit);
        formLayout->addLayout(hl3);

        QHBoxLayout* hl4 = new QHBoxLayout;
        QLabel* lbl4 = new QLabel("协议：");
        lbl4->setFixedWidth(120);
        lbl4->setStyleSheet("color: #495057; font-size: 12px;");
        hl4->addWidget(lbl4);
        ttsProtocolCombo = new QComboBox;
        ttsProtocolCombo->addItem("Qwen（固定）");
        ttsProtocolCombo->setMinimumHeight(30);
        hl4->addWidget(ttsProtocolCombo);
        hl4->addStretch();
        formLayout->addLayout(hl4);

        layout->addWidget(formContainer);
        layout->addStretch();
        stack->addWidget(page);
    }

    // Page 6 - Performance check
    {
        QWidget* page = new QWidget;
        QVBoxLayout* layout = new QVBoxLayout(page);
        layout->setContentsMargins(20, 20, 20, 20);
        layout->setSpacing(15);
        QLabel* label = new QLabel("系统性能检测");
        QFont titleFont = label->font();
        titleFont.setPointSize(14);
        titleFont.setBold(true);
        label->setFont(titleFont);
        label->setStyleSheet("color: #1a1a2e;");
        layout->addWidget(label);
        perfResultLabel = new QLabel("正在检测系统性能...");
        QFont perfFont = perfResultLabel->font();
        perfFont.setPointSize(12);
        perfResultLabel->setFont(perfFont);
        perfResultLabel->setStyleSheet("color: #e67e22;");
        layout->addWidget(perfResultLabel);
        layout->addStretch();
        stack->addWidget(page);
    }

    // Page 7 - Port
    {
        QWidget* page = new QWidget;
        QVBoxLayout* layout = new QVBoxLayout(page);
        layout->setContentsMargins(20, 20, 20, 20);
        layout->setSpacing(15);
        QLabel* label = new QLabel("你希望Lilith Web UI运行在你本地的哪个端口？");
        QFont titleFont = label->font();
        titleFont.setPointSize(14);
        titleFont.setBold(true);
        label->setFont(titleFont);
        label->setStyleSheet("color: #1a1a2e;");
        layout->addWidget(label);
        QHBoxLayout* hl = new QHBoxLayout;
        QLabel* portLabel = new QLabel("Port");
        portLabel->setStyleSheet("color: #495057; font-size: 12px;");
        hl->addWidget(portLabel);
        portEdit = new QLineEdit;
        portEdit->setPlaceholderText("8080");
        portEdit->setFixedWidth(120);
        portEdit->setMinimumHeight(30);
        hl->addWidget(portEdit);
        hl->addStretch();
        layout->addLayout(hl);
        layout->addStretch();
        stack->addWidget(page);
    }

    // Page 8 - LAN
    {
        QWidget* page = new QWidget;
        QVBoxLayout* layout = new QVBoxLayout(page);
        layout->setContentsMargins(20, 20, 20, 20);
        layout->setSpacing(15);
        QLabel* label = new QLabel("是否向你的局域网公开WebUI？");
        QFont titleFont = label->font();
        titleFont.setPointSize(14);
        titleFont.setBold(true);
        label->setFont(titleFont);
        label->setStyleSheet("color: #1a1a2e;");
        layout->addWidget(label);
        lanYes = new QRadioButton("是");
        lanNo = new QRadioButton("否");
        QFont radioFont = lanYes->font();
        radioFont.setPointSize(12);
        lanYes->setFont(radioFont);
        lanNo->setFont(radioFont);
        layout->addWidget(lanYes);
        layout->addWidget(lanNo);
        layout->addStretch();
        connect(lanYes, &QRadioButton::toggled, this, &LilithInstall::onLanYesToggled);
        connect(lanNo, &QRadioButton::toggled, this, &LilithInstall::onLanNoToggled);
        stack->addWidget(page);
    }

    // Page 9 - Account
    {
        QWidget* page = new QWidget;
        QVBoxLayout* layout = new QVBoxLayout(page);
        layout->setContentsMargins(20, 20, 20, 20);
        layout->setSpacing(12);
        QLabel* label = new QLabel("是否需要一个登录账户？");
        QFont titleFont = label->font();
        titleFont.setPointSize(14);
        titleFont.setBold(true);
        label->setFont(titleFont);
        label->setStyleSheet("color: #1a1a2e;");
        layout->addWidget(label);
        needAccountYes = new QRadioButton("是");
        needAccountNo = new QRadioButton("否");
        QFont radioFont = needAccountYes->font();
        radioFont.setPointSize(12);
        needAccountYes->setFont(radioFont);
        needAccountNo->setFont(radioFont);
        layout->addWidget(needAccountYes);
        layout->addWidget(needAccountNo);

        QWidget* formContainer = new QWidget;
        QVBoxLayout* formLayout = new QVBoxLayout(formContainer);
        formLayout->setSpacing(10);

        QHBoxLayout* hl1 = new QHBoxLayout;
        QLabel* lbl1 = new QLabel("用户名：");
        lbl1->setFixedWidth(80);
        lbl1->setStyleSheet("color: #495057; font-size: 12px;");
        hl1->addWidget(lbl1);
        usernameEdit = new QLineEdit;
        usernameEdit->setMinimumHeight(30);
        hl1->addWidget(usernameEdit);
        formLayout->addLayout(hl1);

        QHBoxLayout* hl2 = new QHBoxLayout;
        QLabel* lbl2 = new QLabel("密码：");
        lbl2->setFixedWidth(80);
        lbl2->setStyleSheet("color: #495057; font-size: 12px;");
        hl2->addWidget(lbl2);
        passwordEdit = new QLineEdit;
        passwordEdit->setEchoMode(QLineEdit::Password);
        passwordEdit->setMinimumHeight(30);
        hl2->addWidget(passwordEdit);
        formLayout->addLayout(hl2);

        QHBoxLayout* hl3 = new QHBoxLayout;
        QLabel* lbl3 = new QLabel("确认密码：");
        lbl3->setFixedWidth(80);
        lbl3->setStyleSheet("color: #495057; font-size: 12px;");
        hl3->addWidget(lbl3);
        confirmPasswordEdit = new QLineEdit;
        confirmPasswordEdit->setEchoMode(QLineEdit::Password);
        confirmPasswordEdit->setMinimumHeight(30);
        hl3->addWidget(confirmPasswordEdit);
        formLayout->addLayout(hl3);

        layout->addWidget(formContainer);
        layout->addStretch();
        connect(needAccountYes, &QRadioButton::toggled, this, &LilithInstall::onNeedAccountYesToggled);
        connect(needAccountNo, &QRadioButton::toggled, this, &LilithInstall::onNeedAccountNoToggled);
        stack->addWidget(page);
    }

    // Page 10 - Desktop shortcut
    {
        QWidget* page = new QWidget;
        QVBoxLayout* layout = new QVBoxLayout(page);
        layout->setContentsMargins(20, 20, 20, 20);
        layout->setSpacing(15);
        QLabel* label = new QLabel("要不要创建一个桌面快捷方式启动？");
        QFont titleFont = label->font();
        titleFont.setPointSize(14);
        titleFont.setBold(true);
        label->setFont(titleFont);
        label->setStyleSheet("color: #1a1a2e;");
        layout->addWidget(label);
        desktopShortcut = new QCheckBox("创建桌面快捷方式");
        QFont checkFont = desktopShortcut->font();
        checkFont.setPointSize(12);
        desktopShortcut->setFont(checkFont);
        layout->addWidget(desktopShortcut);
        layout->addStretch();
        stack->addWidget(page);
    }

    // Page 11 - Auto start
    {
        QWidget* page = new QWidget;
        QVBoxLayout* layout = new QVBoxLayout(page);
        layout->setContentsMargins(20, 20, 20, 20);
        layout->setSpacing(15);
        QLabel* label = new QLabel("要不要创建一个开机自启动？");
        QFont titleFont = label->font();
        titleFont.setPointSize(14);
        titleFont.setBold(true);
        label->setFont(titleFont);
        label->setStyleSheet("color: #1a1a2e;");
        layout->addWidget(label);
        autoStart = new QCheckBox("开机自启动");
        QFont checkFont = autoStart->font();
        checkFont.setPointSize(12);
        autoStart->setFont(checkFont);
        layout->addWidget(autoStart);
        layout->addStretch();
        stack->addWidget(page);
    }

    // Page 12 - Privacy
    {
        QWidget* page = new QWidget;
        QVBoxLayout* layout = new QVBoxLayout(page);
        layout->setContentsMargins(20, 20, 20, 20);
        layout->setSpacing(12);
        QLabel* label = new QLabel("是否允许我们收集你的非敏感数据以改进项目？");
        QFont titleFont = label->font();
        titleFont.setPointSize(14);
        titleFont.setBold(true);
        label->setFont(titleFont);
        label->setStyleSheet("color: #1a1a2e;");
        label->setWordWrap(true);
        layout->addWidget(label);
        QLabel* info = new QLabel("我们会收集你的以下数据：\n• WebUI应用程序运行日志（非对话）\n• 输出TTS模型的字数与推理时间\n• 应用程序的失败或错误\n• 你的系统GPU、CPU、内存硬件信息\n\n以上信息会被上传至猫德实验室，我们会严格保护你的数据与信息");
        info->setWordWrap(true);
        QFont infoFont = info->font();
        infoFont.setPointSize(10);
        info->setFont(infoFont);
        info->setStyleSheet("color: #6c757d; line-height: 1.6;");
        layout->addWidget(info);
        privacyAgree = new QRadioButton("我同意上传我的非敏感数据");
        privacyDisagree = new QRadioButton("不要上传我的数据");
        QFont radioFont = privacyAgree->font();
        radioFont.setPointSize(11);
        privacyAgree->setFont(radioFont);
        privacyDisagree->setFont(radioFont);
        layout->addWidget(privacyAgree);
        layout->addWidget(privacyDisagree);
        customPrivacyBtn = new QPushButton("自定义隐私配置");
        customPrivacyBtn->setFixedWidth(160);
        customPrivacyBtn->setMinimumHeight(30);
        layout->addWidget(customPrivacyBtn);
        layout->addStretch();
        connect(customPrivacyBtn, &QPushButton::clicked, this, &LilithInstall::onCustomPrivacy);
        stack->addWidget(page);
    }

    // Page 13 - Custom privacy
    {
        QWidget* page = new QWidget;
        QVBoxLayout* layout = new QVBoxLayout(page);
        layout->setContentsMargins(20, 20, 20, 20);
        layout->setSpacing(12);
        QLabel* label = new QLabel("你希望我们不收集你的哪些数据？");
        QFont titleFont = label->font();
        titleFont.setPointSize(14);
        titleFont.setBold(true);
        label->setFont(titleFont);
        label->setStyleSheet("color: #1a1a2e;");
        layout->addWidget(label);
        checkLogs = new QCheckBox("WebUI应用程序运行日志");
        checkTTS = new QCheckBox("输出TTS模型的字数与推理时间");
        checkErrors = new QCheckBox("应用程序的失败或错误");
        checkHardware = new QCheckBox("系统GPU、CPU、内存硬件信息");
        QFont checkFont = checkLogs->font();
        checkFont.setPointSize(11);
        checkLogs->setFont(checkFont);
        checkTTS->setFont(checkFont);
        checkErrors->setFont(checkFont);
        checkHardware->setFont(checkFont);
        layout->addWidget(checkLogs);
        layout->addWidget(checkTTS);
        layout->addWidget(checkErrors);
        layout->addWidget(checkHardware);
        QPushButton* confirmBtn = new QPushButton("确定");
        confirmBtn->setFixedWidth(100);
        confirmBtn->setMinimumHeight(30);
        layout->addWidget(confirmBtn);
        layout->addStretch();
        connect(confirmBtn, &QPushButton::clicked, this, &LilithInstall::onConfirmCustomPrivacy);
        stack->addWidget(page);
    }

    // Page 14 - Summary
    {
        QWidget* page = new QWidget;
        QVBoxLayout* layout = new QVBoxLayout(page);
        layout->setContentsMargins(20, 20, 20, 20);
        layout->setSpacing(12);
        QLabel* label = new QLabel("最后，确认一遍所有信息");
        QFont titleFont = label->font();
        titleFont.setPointSize(14);
        titleFont.setBold(true);
        label->setFont(titleFont);
        label->setStyleSheet("color: #1a1a2e;");
        layout->addWidget(label);
        QScrollArea* scroll = new QScrollArea;
        summaryLabel = new QLabel;
        summaryLabel->setWordWrap(true);
        QFont summaryFont = summaryLabel->font();
        summaryFont.setPointSize(11);
        summaryLabel->setFont(summaryFont);
        summaryLabel->setStyleSheet("color: #2c3e50; line-height: 1.5;");
        scroll->setWidget(summaryLabel);
        scroll->setWidgetResizable(true);
        layout->addWidget(scroll);
        layout->addStretch();
        stack->addWidget(page);
    }

    // Page 15 - Download progress
    {
        QWidget* page = new QWidget;
        QVBoxLayout* layout = new QVBoxLayout(page);
        layout->setContentsMargins(20, 20, 20, 20);
        layout->setSpacing(15);
        QLabel* label = new QLabel("正在安装");
        QFont titleFont = label->font();
        titleFont.setPointSize(14);
        titleFont.setBold(true);
        label->setFont(titleFont);
        label->setStyleSheet("color: #1a1a2e;");
        layout->addWidget(label);
        downloadStatusLabel = new QLabel("正在检查网络是否可用...");
        QFont statusFont = downloadStatusLabel->font();
        statusFont.setPointSize(11);
        downloadStatusLabel->setFont(statusFont);
        downloadStatusLabel->setStyleSheet("color: #495057;");
        layout->addWidget(downloadStatusLabel);
        downloadProgress = new QProgressBar;
        downloadProgress->setRange(0, 100);
        downloadProgress->setValue(0);
        downloadProgress->setMinimumHeight(22);
        downloadProgress->setTextVisible(true);
        layout->addWidget(downloadProgress);
        QHBoxLayout* hl = new QHBoxLayout;
        pauseBtn = new QPushButton("暂停");
        pauseBtn->setMinimumHeight(30);
        pauseBtn->setFixedWidth(80);
        terminateBtn = new QPushButton("终止安装");
        terminateBtn->setMinimumHeight(30);
        terminateBtn->setFixedWidth(100);
        terminateBtn->hide();
        hl->addWidget(pauseBtn);
        hl->addWidget(terminateBtn);
        hl->addStretch();
        layout->addLayout(hl);
        layout->addStretch();
        connect(pauseBtn, &QPushButton::clicked, this, &LilithInstall::onPauseDownload);
        connect(terminateBtn, &QPushButton::clicked, this, [this]() {
            downloadTerminated = true;
            stack->setCurrentIndex(16);
            resultTitle->setText("安装已终止");
            });
        stack->addWidget(page);
    }

    // Page 16 - Result
    {
        QWidget* page = new QWidget;
        QVBoxLayout* layout = new QVBoxLayout(page);
        layout->setContentsMargins(20, 20, 20, 20);
        layout->setSpacing(12);
        resultTitle = new QLabel;
        QFont resultFont = resultTitle->font();
        resultFont.setPointSize(16);
        resultFont.setBold(true);
        resultTitle->setFont(resultFont);
        resultTitle->setStyleSheet("color: #1a1a2e;");
        layout->addWidget(resultTitle);
        QLabel* logLabel = new QLabel("安装时发生错误，请查看以下详细日志：");
        logLabel->setObjectName("logLabel");
        logLabel->setStyleSheet("color: #495057; font-size: 11px;");
        layout->addWidget(logLabel);
        logView = new QTextEdit;
        logView->setReadOnly(true);
        logView->setMinimumHeight(150);
        QFont logFont = logView->font();
        logFont.setPointSize(10);
        logView->setFont(logFont);
        layout->addWidget(logView);
        QHBoxLayout* hl = new QHBoxLayout;
        hl->setSpacing(8);
        exportLogBtn = new QPushButton("导出日志");
        copyLogBtn = new QPushButton("复制日志");
        uploadLogBtn = new QPushButton("上传至猫德实验室");
        retryBtn = new QPushButton("再试一次");
        launchBtn = new QPushButton("启动 Lilith Web UI");
        closeBtn = new QPushButton("关闭");
        exportLogBtn->setMinimumHeight(30);
        copyLogBtn->setMinimumHeight(30);
        uploadLogBtn->setMinimumHeight(30);
        retryBtn->setMinimumHeight(30);
        launchBtn->setMinimumHeight(30);
        closeBtn->setMinimumHeight(30);
        hl->addWidget(exportLogBtn);
        hl->addWidget(copyLogBtn);
        hl->addWidget(uploadLogBtn);
        hl->addWidget(retryBtn);
        hl->addWidget(launchBtn);
        hl->addWidget(closeBtn);
        hl->addStretch();
        layout->addLayout(hl);
        layout->addStretch();
        connect(exportLogBtn, &QPushButton::clicked, this, &LilithInstall::onExportLog);
        connect(copyLogBtn, &QPushButton::clicked, this, &LilithInstall::onCopyLog);
        connect(uploadLogBtn, &QPushButton::clicked, this, &LilithInstall::onUploadLog);
        connect(retryBtn, &QPushButton::clicked, this, &LilithInstall::onRetryInstall);
        connect(launchBtn, &QPushButton::clicked, this, &LilithInstall::onLaunchWebUI);
        connect(closeBtn, &QPushButton::clicked, this, &LilithInstall::onCloseInstaller);
        stack->addWidget(page);
    }

    // Page 17 - Submit log
    {
        QWidget* page = new QWidget;
        QVBoxLayout* layout = new QVBoxLayout(page);
        layout->setContentsMargins(20, 20, 20, 20);
        layout->setSpacing(12);
        QLabel* label = new QLabel("日志已选中，如果有，请告诉我们其他信息：");
        QFont titleFont = label->font();
        titleFont.setPointSize(13);
        titleFont.setBold(true);
        label->setFont(titleFont);
        label->setStyleSheet("color: #1a1a2e;");
        layout->addWidget(label);
        submitComment = new QTextEdit;
        submitComment->setMinimumHeight(120);
        QFont commentFont = submitComment->font();
        commentFont.setPointSize(11);
        submitComment->setFont(commentFont);
        layout->addWidget(submitComment);
        QHBoxLayout* hl = new QHBoxLayout;
        hl->setSpacing(10);
        submitLogBtn = new QPushButton("提交");
        QPushButton* cancelSubmitBtn = new QPushButton("取消");
        submitLogBtn->setMinimumHeight(30);
        submitLogBtn->setFixedWidth(80);
        cancelSubmitBtn->setMinimumHeight(30);
        cancelSubmitBtn->setFixedWidth(80);
        hl->addWidget(submitLogBtn);
        hl->addWidget(cancelSubmitBtn);
        hl->addStretch();
        layout->addLayout(hl);
        layout->addStretch();
        connect(submitLogBtn, &QPushButton::clicked, this, &LilithInstall::onSubmitLog);
        connect(cancelSubmitBtn, &QPushButton::clicked, this, [this]() {
            stack->setCurrentIndex(16);
            });
        stack->addWidget(page);
    }

    // Navigation buttons
    QHBoxLayout* navLayout = new QHBoxLayout;
    navLayout->setSpacing(10);
    prevBtn = new QPushButton("上一步");
    nextBtn = new QPushButton("下一步");
    cancelBtn = new QPushButton("取消");
    prevBtn->setMinimumHeight(32);
    nextBtn->setMinimumHeight(32);
    cancelBtn->setMinimumHeight(32);
    prevBtn->setFixedWidth(90);
    nextBtn->setFixedWidth(90);
    cancelBtn->setFixedWidth(70);
    navLayout->addWidget(prevBtn);
    navLayout->addStretch();
    navLayout->addWidget(nextBtn);
    navLayout->addWidget(cancelBtn);
    mainLayout->addLayout(navLayout);

    connect(prevBtn, &QPushButton::clicked, this, &LilithInstall::onPrev);
    connect(nextBtn, &QPushButton::clicked, this, &LilithInstall::onNext);
    connect(cancelBtn, &QPushButton::clicked, this, &LilithInstall::onCancel);

    // Default selections
    llmOnline->setChecked(true);
    qualityHigh->setChecked(true);
    ttsLocalDeploy->setChecked(true);
    lanNo->setChecked(true);
    needAccountNo->setChecked(true);
    usernameEdit->hide();
    passwordEdit->hide();
    confirmPasswordEdit->hide();
    privacyAgree->setChecked(true);

    stack->setCurrentIndex(0);
    prevBtn->setEnabled(false);
}

void LilithInstall::onBrowsePath()
{
    QString dir = QFileDialog::getExistingDirectory(this, "选择安装路径");
    if (!dir.isEmpty()) {
        pathEdit->setText(dir);
    }
}

int LilithInstall::determineNextPage(int current)
{
    switch (current) {
    case 0: return 1;
    case 1: return 2;
    case 2: return 3;
    case 3: return 4;
    case 4:
        if (ttsLocalDeploy->isChecked()) return 6;
        if (ttsSkip->isChecked()) return 7;
        return 5;
    case 5: return 7;
    case 6: return 7;
    case 7: return 8;
    case 8:
        if (lanYes->isChecked()) return 9;
        return 10;
    case 9: return 10;
    case 10: return 11;
    case 11: return 12;
    case 12:
        if (privacyAgree->isChecked() || privacyDisagree->isChecked()) return 14;
        return 12;
    case 13: return 14;
    case 14: return 15;
    case 15: return 16;
    default: return current;
    }
}

int LilithInstall::determinePrevPage(int current)
{
    switch (current) {
    case 1: return 0;
    case 2: return 1;
    case 3: return 2;
    case 4: return 3;
    case 5: return 4;
    case 6: return 4;
    case 7:
        if (ttsSkip->isChecked()) return 4;
        if (ttsLocalDeploy->isChecked()) return 6;
        return 5;
    case 8: return 7;
    case 9: return 8;
    case 10: return (lanYes->isChecked()) ? 9 : 8;
    case 11: return 10;
    case 12: return 11;
    case 13: return 12;
    case 14: return 13;
    default: return current - 1;
    }
}

void LilithInstall::onNext()
{
    int next = determineNextPage(currentPage);
    if (next == currentPage) return;

    if (currentPage == 12 && next == 14) {
        updateSummary();
    }
    if (next == 14) {
        updateSummary();
    }
    if (next == 15) {
        prevBtn->setEnabled(false);
        nextBtn->hide();
        cancelBtn->hide();
        simulateDownload();
    }

    currentPage = next;
    stack->setCurrentIndex(currentPage);
    prevBtn->setEnabled(true);

    if (currentPage == 16) {
        prevBtn->hide();
        nextBtn->hide();
        cancelBtn->hide();
    }
}

void LilithInstall::onPrev()
{
    int prev = determinePrevPage(currentPage);
    if (prev == currentPage) return;

    currentPage = prev;
    stack->setCurrentIndex(currentPage);
    prevBtn->setEnabled(currentPage > 0);

    if (currentPage != 16) {
        nextBtn->show();
        cancelBtn->show();
    }
}

void LilithInstall::onCancel()
{
    QMessageBox msgBox(this);
    msgBox.setWindowTitle("取消安装");
    msgBox.setText("你确定要取消吗？安装程序将会关闭，配置不会保存");
    QPushButton* yesBtn = msgBox.addButton("是", QMessageBox::YesRole);
    QPushButton* noBtn = msgBox.addButton("否", QMessageBox::NoRole);
    msgBox.exec();

    if (msgBox.clickedButton() == yesBtn) {
        close();
    }
}

void LilithInstall::onLLMOnlineToggled(bool checked)
{
    Q_UNUSED(checked);
}

void LilithInstall::onLLMLocalToggled(bool checked)
{
    Q_UNUSED(checked);
}

void LilithInstall::onTTSLocalDeployToggled(bool checked)
{
    if (checked) {
        QString result;
        result = "你的计算机未满足该TTS模型的最低要求，确定要安装吗？";
        perfResultLabel->setText(result);
    }
}

void LilithInstall::onTTSOnlineToggled(bool checked)
{
    Q_UNUSED(checked);
}

void LilithInstall::onTTSLocalOtherToggled(bool checked)
{
    Q_UNUSED(checked);
}

void LilithInstall::onTTSSkipToggled(bool checked)
{
    Q_UNUSED(checked);
}

void LilithInstall::onLanYesToggled(bool checked)
{
    Q_UNUSED(checked);
}

void LilithInstall::onLanNoToggled(bool checked)
{
    Q_UNUSED(checked);
}

void LilithInstall::onNeedAccountYesToggled(bool checked)
{
    usernameEdit->setVisible(checked);
    passwordEdit->setVisible(checked);
    confirmPasswordEdit->setVisible(checked);
}

void LilithInstall::onNeedAccountNoToggled(bool checked)
{
    if (checked) {
        usernameEdit->hide();
        passwordEdit->hide();
        confirmPasswordEdit->hide();
    }
}

void LilithInstall::onCustomPrivacy()
{
    currentPage = 13;
    stack->setCurrentIndex(13);
    prevBtn->setEnabled(true);
}

void LilithInstall::onConfirmCustomPrivacy()
{
    currentPage = 12;
    stack->setCurrentIndex(12);
}

void LilithInstall::updateSummary()
{
    QString summary;
    summary += "安装路径：" + pathEdit->text() + "\n\n";
    summary += "LLM服务：" + QString(llmOnline->isChecked() ? "在线" : "本地") + "\n";
    if (llmOnline->isChecked()) {
        summary += "  协议：" + protocolCombo->currentText() + "\n";
        summary += "  API地址：" + apiAddrEdit->text() + "\n";
        summary += "  模型ID：" + modelIdEdit->text() + "\n";
    }
    summary += "\n对话质量：" + QString(qualityHigh->isChecked() ? "高质量" : "普通") + "\n\n";
    summary += "TTS：";
    if (ttsLocalDeploy->isChecked()) summary += "本地部署Qwen3-TTS\n";
    else if (ttsOnline->isChecked()) summary += "在线Qwen3-TTS\n";
    else if (ttsLocalOther->isChecked()) summary += "本地（其他）\n";
    else summary += "日后再谈\n";
    if (ttsOnline->isChecked() || ttsLocalOther->isChecked()) {
        summary += "  TTS API地址：" + ttsApiAddrEdit->text() + "\n";
        summary += "  TTS 模型ID：" + ttsModelIdEdit->text() + "\n";
    }
    summary += "\n端口：" + portEdit->text() + "\n";
    summary += "局域网公开：" + QString(lanYes->isChecked() ? "是" : "否") + "\n";
    if (lanYes->isChecked() && needAccountYes->isChecked()) {
        summary += "  用户名：" + usernameEdit->text() + "\n";
    }
    summary += "桌面快捷方式：" + QString(desktopShortcut->isChecked() ? "是" : "否") + "\n";
    summary += "开机自启动：" + QString(autoStart->isChecked() ? "是" : "否") + "\n";
    summary += "隐私数据：" + QString(privacyAgree->isChecked() ? "同意上传" : "不上传") + "\n";

    summaryLabel->setText(summary);
}

void LilithInstall::onStartInstall()
{
    stack->setCurrentIndex(15);
    simulateDownload();
}

void LilithInstall::onRollback()
{
    currentPage = 14;
    stack->setCurrentIndex(14);
    nextBtn->show();
    cancelBtn->show();
    prevBtn->setEnabled(true);
}

void LilithInstall::onCancelConfirmYes()
{
    close();
}

void LilithInstall::onCancelConfirmNo()
{
    Q_UNUSED(this);
}

void LilithInstall::onPauseDownload()
{
    downloadPaused = !downloadPaused;
    if (downloadPaused) {
        pauseBtn->setText("继续");
        terminateBtn->show();
        downloadStatusLabel->setText("下载已暂停");
    }
    else {
        pauseBtn->setText("暂停");
        terminateBtn->hide();
    }
}

void LilithInstall::onRetryDownload()
{
    downloadPaused = false;
    downloadTerminated = false;
    downloadProgress->setValue(0);
    downloadStatusLabel->setText("正在重新尝试连接下载地址...");
    pauseBtn->setText("暂停");
    terminateBtn->hide();
}

void LilithInstall::onConfigProxy()
{
    Q_UNUSED(this);
}

void LilithInstall::onExportLog()
{
    QString fileName = QFileDialog::getSaveFileName(this, "导出日志", "install_log.txt", "Text Files (*.txt)");
    if (!fileName.isEmpty()) {
        QFile file(fileName);
        if (file.open(QIODevice::WriteOnly | QIODevice::Text)) {
            QTextStream stream(&file);
            stream << logView->toPlainText();
            file.close();
        }
    }
}

void LilithInstall::onCopyLog()
{
    logView->selectAll();
    logView->copy();
}

void LilithInstall::onUploadLog()
{
    stack->setCurrentIndex(17);
    prevBtn->hide();
    nextBtn->hide();
    cancelBtn->hide();
}

void LilithInstall::onRetryInstall()
{
    stack->setCurrentIndex(15);
    downloadPaused = false;
    downloadTerminated = false;
    downloadProgress->setValue(0);
    downloadStatusLabel->setText("正在重新尝试安装...");
    pauseBtn->setText("暂停");
    terminateBtn->hide();
}

void LilithInstall::onLaunchWebUI()
{
    Q_UNUSED(this);
}

void LilithInstall::onCloseInstaller()
{
    close();
}

void LilithInstall::onSubmitLog()
{
    stack->setCurrentIndex(16);
    prevBtn->hide();
    nextBtn->hide();
    cancelBtn->hide();
}

void LilithInstall::simulateDownload()
{
    downloadProgress->setValue(0);
    downloadStatusLabel->setText("正在下载所需要的依赖：Qt6 Runtime...");

    downloadProgress->setValue(50);
    downloadStatusLabel->setText("正在下载所需要的依赖：Lilith Core...");

    downloadProgress->setValue(100);
    downloadStatusLabel->setText("下载完成！");

    stack->setCurrentIndex(16);
    resultTitle->setText("安装途中无异常，万事俱备！");
    logView->setText("安装成功完成。\n所有依赖已安装。");

    QLabel* logLabel = stack->widget(16)->findChild<QLabel*>("logLabel");
    if (logLabel) logLabel->hide();
    exportLogBtn->hide();
    copyLogBtn->hide();
    uploadLogBtn->hide();
    retryBtn->hide();
    launchBtn->show();
    closeBtn->show();
    prevBtn->hide();
    nextBtn->hide();
    cancelBtn->hide();
}