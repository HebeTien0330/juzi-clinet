'''FileHeader
: @Author: tangchengqin
: @Date: 2026/3/19 14:12:01
: @LastEditors: tangchengqin
: @LastEditTime: 2026/3/19 17:09:31
: @Description: 
: @Copyright: Copyright (©)}) 2026 Clarify. All rights reserved.
: @Email: 527094604@qq.com
'''
import json

class ConfigManager:

    _CONFIG = "./config/config.json"

    def __init__(self):
        with open(self._CONFIG) as file:
            self.m_config = json.load(file)

    def get(self, key):
        return self.m_config[key]

    def getConfig(self):
        return self.m_config
