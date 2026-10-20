from utils.logger import logfile, LogLevel
from utils.box import Box
from core.config import ConfigManager
from core.parser import Parser
from importlib import import_module
import json
import shutil
import os

class ParserTemplate(Parser):

    def __init__(self):
        Parser.__init__(self)
        self.clearExistFiles()

    def doParse(self):
        self.tidy()
        clazzPath = Box.get(ConfigManager).get("Clazz")
        if not clazzPath:
            logfile(LogLevel.ERROR, "no clazz path")
            return
        writerList = os.listdir(clazzPath)
        for filename in writerList:
            if filename == "__init__.py" or filename[-3:] != ".py":
                continue            
            target = import_module(f"clazz.{filename[:-3]}")
            if not target:
                logfile(LogLevel.ERROR, "error writer file path")
                continue
            if not hasattr(target, "Writer"):
                logfile(LogLevel.ERROR, f"file {filename} no writer")
                continue
            Writer = getattr(target, "Writer")
            Writer().write()

    def tidy(self):
        path = Box.get(ConfigManager).get("MiddleFile")
        for filename in os.listdir(path):
            if filename[-5:] != ".json":
                continue
            with open(os.path.join(path, filename), "r", encoding="utf-8") as file1:
                jsonObj = json.loads(file1.read())
                jsonObj = sorted(jsonObj.items(), key = lambda x:int(x[0]) if isinstance(x[0], int) else x[0])
                jsonObj = dict(jsonObj)
                with open(os.path.join(path, filename), "w", encoding="utf-8") as file2:
                    file2.write(json.dumps(jsonObj, indent=4, ensure_ascii=False))

    def clearExistFiles(self):
        path = Box.get(ConfigManager).get("MiddleFile")
        if os.path.exists(path):
            shutil.rmtree(path)
        os.mkdir(path)


if __name__ == "__main__":
    ParserTemplate().parse()
