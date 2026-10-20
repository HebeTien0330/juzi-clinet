'''FileHeader
: @Author: tangchengqin
: @Date: 2026/3/19 11:37:34
: @LastEditors: tangchengqin
: @LastEditTime: 2026/3/19 14:05:55
: @Description: 
: @Copyright: Copyright (©)}) 2026 Clarify. All rights reserved.
: @Email: 527094604@qq.com
'''

"""
这是一个依赖注入容器（Dependency Injection Container）的简单实现，用于管理类实例的生命周期。
主要功能
1、单例模式管理：为每个类创建唯一的实例并缓存
2、依赖注入：提供统一的实例获取机制
3、容器管理：支持实例的添加、删除和获取操作
"""

from utils.logger import logfile, LogLevel

class Box:
    _boxMap = {}

    @staticmethod
    def _getUniqueId(constructor):
        """
        获取类的唯一id
        """
        return f"{constructor.__module__}.{constructor.__qualname__}"

    @classmethod
    def add(cls, constructor):
        uid = cls._getUniqueId(constructor)
        if uid in cls._boxMap:
            logfile(LogLevel.ERROR, f"box has already added {uid} {constructor}")
            return
        instance = constructor()
        cls._boxMap[uid] = instance
        return instance

    @classmethod
    def remove(cls, constructor):
        uid = Box._getUniqueId(constructor)
        if uid not in cls._boxMap:
            logfile(LogLevel.ERROR, f"box has not added {uid} {constructor}")
            return
        del cls._boxMap[uid]

    @classmethod
    def get(cls, constructor):
        uid = Box._getUniqueId(constructor)
        if uid not in cls._boxMap:
            logfile(LogLevel.ERROR, f"{uid} {constructor} does not exist")
            return
        return cls._boxMap[uid]
