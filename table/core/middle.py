'''FileHeader
: @Author: tangchengqin
: @Date: 2026/3/19 17:33:27
: @LastEditors: tangchengqin
: @LastEditTime: 2026/3/19 17:47:47
: @Description: 
: @Copyright: Copyright (©)}) 2026 Clarify. All rights reserved.
: @Email: 527094604@qq.com
'''
from core.config import ConfigManager
from utils.logger import logfile, LogLevel
from utils.box import Box
from copy import deepcopy
import os
import json
import re

"""
中间件生成器
生成Excel文件 -> json文件/脚本 的中间文件
格式为json
"""
class MiddleWriter:

    def __init__(self):
        self.workbook = None
        self.filename = None

    # 绑定要操作的workbook
    def bindWorkbook(self, workbook, filename):
        self.workbook = workbook
        self.filename = filename

    # 写入中间文件
    def writeMiddleFile(self):
        sheetnames = self.workbook.sheetnames
        for sheetname in sheetnames:
            names = sheetname.split("|")
            if len(names) != 2:
                logfile(LogLevel.ERROR, f"incorrect sheet name {sheetname} in {self.filename}")
                continue
            logfile(LogLevel.INFO, f"parsering {sheetname} in {self.filename}")
            sheet = self.workbook.get_sheet_by_name(sheetname)
            name = names[0]
            jsonObj = self.tarnslate2Json(sheet)
            if not jsonObj:
                logfile(LogLevel.INFO, f"{sheetname} in {self.filename} is empty")
                continue
            configManager = Box.get(ConfigManager)
            middleFilePath = configManager.get("MiddleFile") + name + ".json"
            if os.path.exists(middleFilePath):
                existFile = open(middleFilePath, "r", encoding="utf-8")
                existObj = json.load(existFile)
                jsonObj = eval(jsonObj)
                jsonObj = json.dumps({**existObj, **jsonObj}, indent=4, ensure_ascii=False)
                existFile.close()
            with open(middleFilePath, "w", encoding="utf-8") as file:
                file.write(f"{jsonObj}")

    def getRowValues(self, sheet, row):
        return [cell.value for cell in sheet[row]]

    def clearNoneValues(self, rowValues):
        final = []
        marked = False
        for value in rowValues[::-1]:
            if not marked and value is None:
                continue
            marked = True
            final.append(value)
        return final[::-1]

    def tarnslate2Json(self, sheet):
        self.keys = self.getRowValues(sheet, 2)
        # 清除末尾的None值
        self.keys = self.clearNoneValues(self.keys)
        # 每行数据取多少个值取决于key有多少个
        count = len(self.keys)
        self.types = self.getRowValues(sheet, 3)[:count]
        stack = self.recursivelyGenStructure(deepcopy(self.keys))
        final = {}
        row = 0
        for data in sheet.iter_rows(values_only=True):
            row += 1
            # 跳过前三行
            if row in [1, 2, 3]:
                continue
            # 过滤掉export为否的行
            if not data[0] or data[0] == "否":
                continue
            # 取对应key数量的前n个数据
            data = list(data)[:count]
            dataMap = dict(zip(self.keys, data))
            jsonObj = self.fillWithData(deepcopy(stack), dataMap)
            final = self.merge(final, jsonObj)
        return json.dumps(final, indent=4, ensure_ascii=False)

    # 递归生成数据结构
    def recursivelyGenStructure(self, keys, idx = 0, stack = None):
        if idx == len(keys) - 1:
            return stack
        if not stack:
            # 数据结构栈
            stack = []
        key = keys[idx]
        if key == "export":
            idx += 1
            return self.recursivelyGenStructure(keys, idx, stack)
        reObj = re.match("^#+", key)
        if not reObj:
            stack.append(keys)
            idx = len(keys) - 1
            return self.recursivelyGenStructure(keys, idx, stack)
        stack.append(key)
        idx += 1
        return self.recursivelyGenStructure(keys, idx, stack)

    def getType(self, key):
        idx = self.keys.index(key)
        return self.types[idx]

    def fillWithData(self, stack, dataMap):
        ret = {}
        while stack:
            e = stack.pop()
            if type(e) == list:
                for key in e:
                    if key == "export":
                        continue
                    value = dataMap[key]
                    if value is None:
                        continue
                    keyType = self.getType(key)
                    if key == "" or value == "":
                        continue
                    elif keyType == "int":
                        data = int(value)
                    elif keyType == "float":
                        data = float(value)
                    elif keyType == "str":
                        data = str(value)
                    elif keyType == "bool":
                        if value == "是":
                            data = True
                        else:
                            data = False
                    else:
                        try:
                            data = eval(int(value))
                        except:
                            try:
                                data = eval(str(value))
                            except:
                                data = str(value)
                    key = re.sub("^#+", "", key)
                    ret[key] = data
            else:
                try:
                    ret = { int(dataMap[e]): ret }
                except:
                    ret = { str(dataMap[e]): ret }
        return ret

    def merge(self, final, jsonObj):
        for key, value in jsonObj.items():
            if key not in final:
                final[key] = value
                continue
            final[key] = self.merge(final[key], value)
        return final
