'''FileHeader
: @Author: tangchengqin
: @Date: 2026/3/19 13:57:39
: @LastEditors: tangchengqin
: @LastEditTime: 2026/3/19 14:07:10
: @Description: 
: @Copyright: Copyright (©)}) 2026 Clarify. All rights reserved.
: @Email: 527094604@qq.com
'''
import os
import datetime

class LogLevel:
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class Logger:

    __isinstance = None

    def __init__(self, path):
        self.path = path
        self.init()

    def __new__(cls, *args, **kwargs):
        if cls.__isinstance:
            return cls.__isinstance
        cls.__isinstance = object.__new__(cls)
        return cls.__isinstance

    def init(self):
        if os.path.exists(self.path):
            return
        os.makedirs(self.path)

    def logfile(self, path, logLevel, text):
        logout = f"[{datetime.datetime.now()}][{logLevel}]: {text}\n"
        print(logout, end="")
        # with open(path, 'a', encoding="utf-8") as file:
        #     print(logout, end="")
        #     file.write(logout)


def _initLogger(logPath):
    if "g_Logger" not in globals():
        global g_Logger
        g_Logger = Logger(logPath)

def _getLogger():
    global g_Logger
    if 'g_Logger' not in globals():
        _initLogger("./data/log")  # 提供默认路径
    return g_Logger

def logfile(logLevel, text):
    path = "./data/log/log.log"
    g_Logger = _getLogger()
    g_Logger.logfile(path, logLevel, text)
