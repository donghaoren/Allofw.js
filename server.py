from autobahn.twisted.wamp import ApplicationSession, ApplicationRunner, RouterFactory, RouterSessionFactory
from autobahn.wamp import types
from autobahn.twisted.websocket import WampWebSocketServerFactory
from autobahn.twisted.resource import WebSocketResource
from twisted.internet.defer import inlineCallbacks
from twisted.web.server import Site
from twisted.web.static import File
from twisted.internet import reactor

import zmq
import struct
import msgpack
import yaml
import socket
import hashlib

# Load config.
with open("config.yaml", "rb") as f:
    config = yaml.load(f.read().decode("utf-8"))
    hostname = socket.gethostname()
    if hostname in config:
        for entry in config['hostname']:
            config[entry] = config['hostname'][entry]

# ZMQ context.
zmq_context = zmq.Context()

socket = zmq_context.socket(zmq.REQ)
socket.connect(config['server'])

def RequestResponse(req):
    data = msgpack.packb(req);
    socket.send(data)
    return msgpack.unpackb(socket.recv())

def Sketch_Run(name, code):
    return RequestResponse({
        "type": "sketch.run",
        "name": name,
        "code": code
    })

def Sketch_List():
    return RequestResponse({
        "type": "sketch.list"
    })

def Sketch_Stop(name):
    return RequestResponse({
        "type": "sketch.stop",
        "name": name
    })

def Sketch_GetCode(name):
    return RequestResponse({
        "type": "sketch.get_code",
        "name": name
    })

def Project_List():
    return RequestResponse({
        "type": "project.list"
    })

def Project_Delete(name):
    return RequestResponse({
        "type": "project.delete",
        "name": name
    })

def Project_UploadFile(name, filename, content):
    return RequestResponse({
        "type": "project.upload_file",
        "name": name,
        "filename": filename,
        "content": content
    })

def Project_RenameFile(name, dest, src):
    return RequestResponse({
        "type": "project.rename_file",
        "name": name,
        "destination": dest,
        "source": src
    })

def Project_ListFiles(name):
    return RequestResponse({
        "type": "project.list_files",
        "name": name
    })

def Project_LoadProject(name):
    return RequestResponse({
        "type": "project.load_project",
        "name": name
    })

def Project_SaveProject(name, project):
    return RequestResponse({
        "type": "project.save_project",
        "name": name,
        "project": project
    })


def ListenEvents():
    events = zmq_context.socket(zmq.SUB)
    events.connect(config['events'])
    events.setsockopt(zmq.SUBSCRIBE, "")
    while True:
        try:
            msg = msgpack.unpackb(events.recv())
            yield msg['source'], msg['message']
        except zmq.error.ContextTerminated:
            break
        except:
            print "Error!"
            pass


class AllofwServer(ApplicationSession):
    @inlineCallbacks
    def onJoin(self, details):
        def listen_to_events():
            for source, event in ListenEvents():
                self.publish("allofw.event.sketch.%s" % hashlib.md5(source).hexdigest(), event)

        reactor.addSystemEventTrigger('before', 'shutdown', zmq_context.destroy)
        reactor.callInThread(listen_to_events)

        yield self.register(Sketch_Run, u"allofw.sketch.run")
        yield self.register(Sketch_Stop, u"allofw.sketch.stop")
        yield self.register(Sketch_List, u"allofw.sketch.list")
        yield self.register(Sketch_GetCode, u"allofw.sketch.get_code")

        yield self.register(Project_List, u"allofw.project.list")
        yield self.register(Project_Delete, u"allofw.project.delete")
        yield self.register(Project_UploadFile, u"allofw.project.upload_file")
        yield self.register(Project_RenameFile, u"allofw.project.rename_file")
        yield self.register(Project_ListFiles, u"allofw.project.list_files")
        yield self.register(Project_LoadProject, u"allofw.project.load_project")
        yield self.register(Project_SaveProject, u"allofw.project.save_project")

root = File("static")
session_factory = RouterSessionFactory(RouterFactory())
component_config = types.ComponentConfig(realm = "anonymous")
session_factory.add(AllofwServer(component_config))
factory = WampWebSocketServerFactory(session_factory)
factory.startFactory()
resource = WebSocketResource(factory)
root.putChild("ws", resource)

site = Site(root)
reactor.listenTCP(int(config['webserver']['port']), site, config['webserver']['listen'])

reactor.run()
