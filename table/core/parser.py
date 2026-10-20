'''FileHeader
: @Author: tangchengqin
: @Date: 2026/3/19 18:19:58
: @LastEditors: tangchengqin
: @LastEditTime: 2026/3/19 18:21:49
: @Description: 
: @Copyright: Copyright (©)}) 2026 Clarify. All rights reserved.
: @Email: 527094604@qq.com
'''
from core.reader import ExcelReader
from core.middle import MiddleWriter

"""
解析器
负责调用读取器、生成器，并负责分配目标文件的提交、分发
"""
class Parser:

    def parse(self):
        middleWriter = MiddleWriter()
        for fileName, workBook in ExcelReader():
            middleWriter.bindWorkbook(workBook, fileName)
            middleWriter.writeMiddleFile()
        self.doParse()

    # 具体实现重载该方法
    def doParse(self):
        pass
