#include <QApplication>
#include "src/ui/lilith_install.h"

int main(int argc, char* argv[])
{
    QApplication app(argc, argv);
    app.setApplicationName("Lilith Installer");

    LilithInstall window;
    window.setWindowTitle("莉莉丝安装程序");
    window.resize(700, 520);
    window.show();

    return app.exec();
}