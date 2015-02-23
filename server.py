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


zmq_context = zmq.Context()

socket = zmq_context.socket(zmq.REQ)
socket.connect("tcp://127.0.0.1:3001")

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


class AllofwServer(ApplicationSession):
    @inlineCallbacks
    def onJoin(self, details):
        # def listen_for_parameter_change():
        #     for event in ListenEvents():
        #         self.publish("allovolume.renderer.parameter_changed", event)

        # reactor.addSystemEventTrigger('before', 'shutdown', zmq_context.destroy)
        # reactor.callInThread(listen_for_parameter_change)

        yield self.register(Sketch_Run, u"allofw.sketch.run")
        yield self.register(Sketch_Stop, u"allofw.sketch.stop")
        yield self.register(Sketch_List, u"allofw.sketch.list")
        yield self.register(Sketch_GetCode, u"allofw.sketch.get_code")

root = File("static")
session_factory = RouterSessionFactory(RouterFactory())
component_config = types.ComponentConfig(realm = "anonymous")
session_factory.add(AllofwServer(component_config))
factory = WampWebSocketServerFactory(session_factory)
factory.startFactory()
resource = WebSocketResource(factory)
root.putChild("ws", resource)

site = Site(root)
reactor.listenTCP(8000, site, interface = "127.0.0.1")

reactor.run()
