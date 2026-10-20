from core.writer import BaseWriter
import json

class Writer(BaseWriter):

    def __init__(self):
        BaseWriter.__init__(self)
        # 在这里登记要导出的表名，例如 ["const", "item"]
        self.filename = []

    def write(self):
        if not self.filename:
            return
        BaseWriter.write(self)

    def doWrite(self, jsonObj, outputPath):
        with open(outputPath, "w", encoding="utf-8") as outputFile:
            if outputPath.endswith("const.json"):
                newJsonObj = {}
                for key, value in jsonObj.items():
                    newJsonObj[key] = value["value"]
                json.dump(newJsonObj, outputFile, ensure_ascii=False, indent=4)
            else:
                json.dump(jsonObj, outputFile, ensure_ascii=False, indent=4)
