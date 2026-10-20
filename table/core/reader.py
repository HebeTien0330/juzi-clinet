'''FileHeader
: @Author: tangchengqin
: @Date: 2026/3/19 14:07:51
: @LastEditors: tangchengqin
: @LastEditTime: 2026/3/19 14:09:58
: @Description: 
: @Copyright: Copyright (©)}) 2026 Clarify. All rights reserved.
: @Email: 527094604@qq.com
'''

"""
Excel读取器
用于读取config设置的路径下的Excel文件
生成workbook对象，并以迭代器的方式返回
"""

from utils.logger import logfile, LogLevel
from utils.box import Box
from core.config import ConfigManager
import openpyxl
import os

class ExcelReader:

    def __init__(self):
        self.fileList = self.loadExcel()
        self._pointer = 0

    def __iter__(self):
        while self._pointer < len(self.fileList):
            fileName = self.fileList[self._pointer]
            if not fileName.endswith(".xlsx"):
                self._pointer += 1
                continue
            path = Box.get(ConfigManager).get("ExcelPath")
            workBook = openpyxl.load_workbook(f"{path}/{fileName}")
            yield fileName, workBook
            self._pointer += 1

    def loadExcel(self):
        path = Box.get(ConfigManager).get("ExcelPath")
        if not path:
            errInfo = "ExcelPath is None"
            logfile(LogLevel.ERROR, errInfo)
            raise Exception(errInfo)
        fileList = os.listdir(path)
        return fileList
