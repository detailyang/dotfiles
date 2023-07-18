package main

import (
	"fmt"
	"math"
	"net"
	"strconv"
	"strings"

	aw "github.com/deanishe/awgo"
	"github.com/pkg/errors"
)

type networkManagement interface {
	calculate() error
	addNewItem()
}

type network struct {
	query         string
	qType         networkManagement
	ip            net.IP
	prefix        int
	subnetMask    net.IP
	networkAddr   net.IP
	broadcastAddr net.IP
	wildcardMask  net.IP
}

var wf *aw.Workflow

func init() {
	wf = aw.New()
}

func main() {
	args := wf.Args()
	network := new(network)
	network.query = args[0]
	network.applyProcessType()

	wf.NewItem(fmt.Sprintf("query: %s", network.query))

	if err := network.qType.calculate(); err != nil {
		wf.NewItem(fmt.Sprintf("error: %+v", err))
		wf.SendFeedback()
		return
	}
	network.qType.addNewItem()
	wf.SendFeedback()
}

func (n *network) applyProcessType() {
	if strings.HasPrefix(n.query, `/`) {
		// ex: /24
		n.qType = &ipv4Prefix{n}
	} else if strings.Contains(n.query, `/`) {
		// ex: 192.168.24.11/24 or 192.168.24.11/255.255.255.0
		n.qType = &ipv4CIDR{n}
	} else {
		// ex: 255.255.255.0
		n.qType = &ipv4SubnetMask{n}
	}
}

// struct for /22
type ipv4Prefix struct {
	n *network
}

// struct for 192.168.33.12/21 or 192.146.11.22/255.255.255.0
type ipv4CIDR struct {
	n *network
}

// struct for 255.255.252.0
type ipv4SubnetMask struct {
	n *network
}

const maxPrefix = 32
const ipSliceLen = 4

func (self *ipv4Prefix) calculate() error {
	var err error
	self.n.prefix, err = strconv.Atoi(self.n.query[1:])
	if err != nil {
		return err
	}
	if self.n.prefix > maxPrefix {
		return errors.New("格式不对")
	}

	subnetMask := net.CIDRMask(self.n.prefix, maxPrefix)
	self.n.subnetMask = net.IP(subnetMask)

	buildWildCardMask(self.n, subnetMask)
	return nil
}

func (self *ipv4Prefix) addNewItem() {
	addDefaultItem(self.n)
}

func (self *ipv4CIDR) calculate() error {
	var err error
	var ipv4Net *net.IPNet

	cidr := self.n.query
	t := strings.Split(self.n.query, "/")
	if strings.Contains(t[1], ".") {
		subnetMask := net.ParseIP(t[1]).To4()
		ipMask := net.IPMask(subnetMask)
		prefix, b := ipMask.Size()
		if prefix == 0 && b == 0 {
			return errors.New("ipv4CIDR 格式不对")
		}
		cidr = t[0] + "/" + strconv.Itoa(prefix)
	}

	self.n.ip, ipv4Net, err = net.ParseCIDR(cidr)
	if err != nil {
		return err
	}

	self.n.networkAddr = ipv4Net.IP
	self.n.subnetMask = net.IP(ipv4Net.Mask)
	self.n.prefix, _ = ipv4Net.Mask.Size()

	self.n.broadcastAddr = make([]byte, ipSliceLen)
	copy(self.n.broadcastAddr, self.n.ip.To4())
	for i, v := range ipv4Net.Mask {
		self.n.broadcastAddr[i] |= v ^ 255
	}

	buildWildCardMask(self.n, ipv4Net.Mask)
	return nil
}

func (self *ipv4CIDR) addNewItem() {
	wf.NewItem(self.n.ip.String()).
		Subtitle(`ip`).
		Arg(self.n.ip.String()).
		Valid(true)
	wf.NewItem(self.n.networkAddr.String() + " ~ " + self.n.broadcastAddr.String()).
		Subtitle(`network range`).
		Arg(self.n.networkAddr.String() + " ~ " + self.n.broadcastAddr.String()).
		Valid(true)
	addDefaultItem(self.n)
}

func (self *ipv4SubnetMask) calculate() error {
	self.n.subnetMask = net.ParseIP(self.n.query).To4()
	if self.n.subnetMask == nil {
		return errors.New("ipv4SubnetMask:格式不对")
	}
	var b int
	ipMask := net.IPMask(self.n.subnetMask)
	self.n.prefix, b = ipMask.Size()
	if self.n.prefix == 0 && b == 0 {
		return errors.New("ipv4SubnetMask:格式不对")
	}
	buildWildCardMask(self.n, ipMask)
	return nil
}

func (self *ipv4SubnetMask) addNewItem() {
	addDefaultItem(self.n)
}

func addDefaultItem(n *network) {
	wf.NewItem(`/` + strconv.Itoa(n.prefix)).
		Subtitle(`network prefix`).
		Arg(`/` + strconv.Itoa(n.prefix)).
		Valid(true)
	wf.NewItem(n.subnetMask.String()).
		Subtitle(`subnet mask`).
		Arg(n.subnetMask.String()).
		Valid(true)
	wf.NewItem(n.wildcardMask.String()).
		Subtitle(`wildcard mask`).
		Arg(n.wildcardMask.String()).
		Valid(true)

	v := int(math.Exp2(float64(maxPrefix - n.prefix)))
	wf.NewItem(fmt.Sprintf("%d", v)).
		Subtitle(`ip count`).
		Arg(fmt.Sprintf("%d", v)).
		Valid(true)
}

func buildWildCardMask(n *network, mask net.IPMask) {
	n.wildcardMask = make([]byte, ipSliceLen)
	for i, v := range mask {
		n.wildcardMask[i] = v ^ 255
	}
}
