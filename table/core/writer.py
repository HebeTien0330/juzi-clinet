'''FileHeader
: @Author: tangchengqin
: @Date: 2026/3/19 17:19:53
: @LastEditors: tangchengqin
: @LastEditTime: 2026/3/19 17:23:44
: @Description: 
: @Copyright: Copyright (©)}) 2026 Clarify. All rights reserved.
: @Email: 527094604@qq.com
'''
from utils.logger import logfile, LogLevel
from utils.box import Box
from core.config import ConfigManager
import os
import json

"""
目标文件生成器
由中间文件生成目标文件
可以生成json文件或任意语言的脚本，具体看使用者的配置
使用者可以继承该类，通过重载doWrite方法实现具体生成逻辑
"""

class BaseWriter:

    def __init__(self):
        self.createOutputDir()
        self.filename = None

    def createOutputDir(self):
        dirPath = Box.get(ConfigManager).get("Output")
        if not dirPath:
            errInfo = "Output path is not set"
            logfile(LogLevel.ERROR, errInfo)
            raise Exception(errInfo)
        if not os.path.isdir(dirPath):
            os.mkdir(dirPath)

    def write(self):
        if not self.filename:
            logfile(LogLevel.ERROR, "filename is not set")
            return
        middleFileDir = Box.get(ConfigManager).get("MiddleFile")
        if not os.path.isdir(middleFileDir):
            logfile(LogLevel.ERROR, "middleFileDir is not exist, create it now")
            os.mkdir(middleFileDir)
        if isinstance(self.filename, str):
            filenames = [self.filename]
        else:
            filenames = self.filename
        output = Box.get(ConfigManager).get("Output")
        for filename in filenames:
            filepath = os.path.join(middleFileDir, f"{filename}.json")
            with open(filepath, "r", encoding="utf-8") as file:
                jsonObj = json.loads(file.read())
                self.doWrite(jsonObj, os.path.join(output, f"{filename}.json"))

    def doWrite(self, jsonObj, outputPath):
        errInfo = "doWrite is waiting to be overrided"
        logfile(LogLevel.ERROR, errInfo)
        raise Exception(errInfo)
